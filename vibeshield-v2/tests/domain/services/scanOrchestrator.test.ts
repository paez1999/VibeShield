import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScanOrchestrator } from '@/domain/services/scanOrchestrator'
import type { CodeRepository, FileEntry } from '@/domain/ports/codeRepository'
import type { ScanStore } from '@/domain/ports/scanStore'
import type { VulnStore } from '@/domain/ports/vulnStore'
import type { AiAnalyzer } from '@/domain/ports/aiAnalyzer'
import type { BillingService } from '@/domain/ports/billingService'
import { ScanLimitError, BranchNotFoundError } from '@/shared/errors'

// ── Mock factories ────────────────────────────────────────────────────────────

function makeCodeRepo(overrides: Partial<CodeRepository> = {}): CodeRepository {
  return {
    resolveRef: vi.fn().mockResolvedValue('sha123'),
    fetchTree: vi.fn().mockResolvedValue([
      { path: 'src/index.ts', sha: 'file-sha-1', size: 100, type: 'blob' } as FileEntry,
    ]),
    fetchFileContent: vi.fn().mockResolvedValue('const x = 1;'),
    ...overrides,
  }
}

function makeScanStore(overrides: Partial<ScanStore> = {}): ScanStore {
  return {
    create: vi.fn().mockResolvedValue('scan-id-1'),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue(null),
    listByOrg: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    countByOrgSince: vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

function makeVulnStore(overrides: Partial<VulnStore> = {}): VulnStore {
  return {
    upsertMany: vi.fn().mockResolvedValue(0),
    listByOrg: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    summaryByOrg: vi.fn().mockResolvedValue({ critical: 0, high: 0, medium: 0, low: 0, info: 0 }),
    resolve: vi.fn().mockResolvedValue(undefined),
    ignore: vi.fn().mockResolvedValue(undefined),
    autoResolveStale: vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

function makeAiAnalyzer(overrides: Partial<AiAnalyzer> = {}): AiAnalyzer {
  return {
    analyzeBatch: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

function makeBilling(overrides: Partial<BillingService> = {}): BillingService {
  return {
    canScan: vi.fn().mockResolvedValue({ allowed: true }),
    recordScan: vi.fn().mockResolvedValue(undefined),
    getPlan: vi.fn().mockResolvedValue({ type: 'pro', includesAi: true, includesDetails: true, scanLimit: null }),
    ...overrides,
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ScanOrchestrator', () => {
  let codeRepo: CodeRepository
  let scanStore: ScanStore
  let vulnStore: VulnStore
  let aiAnalyzer: AiAnalyzer
  let billing: BillingService
  let orchestrator: ScanOrchestrator

  beforeEach(() => {
    codeRepo = makeCodeRepo()
    scanStore = makeScanStore()
    vulnStore = makeVulnStore()
    aiAnalyzer = makeAiAnalyzer()
    billing = makeBilling()
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)
  })

  // 1. Billing denial
  it('throws ScanLimitError when billing denies scan', async () => {
    billing = makeBilling({
      canScan: vi.fn().mockResolvedValue({ allowed: false, reason: 'Scan limit reached' }),
    })
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)

    await expect(
      orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main'),
    ).rejects.toThrow(ScanLimitError)
  })

  // 2. Scan record creation
  it('creates a scan record and returns its id', async () => {
    const scanId = await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(scanStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', userId: 'user-1', repo: 'owner/repo', ref: 'main' }),
    )
    expect(scanId).toBe('scan-id-1')
  })

  // 3. BranchNotFoundError when resolveRef returns null
  it('throws BranchNotFoundError when ref cannot be resolved', async () => {
    codeRepo = makeCodeRepo({ resolveRef: vi.fn().mockResolvedValue(null) })
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)

    await expect(
      orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'missing-branch'),
    ).rejects.toThrow(BranchNotFoundError)
  })

  // 4. scanStore.fail called on pipeline error
  it('calls scanStore.fail on pipeline error', async () => {
    const err = new Error('network failure')
    codeRepo = makeCodeRepo({ resolveRef: vi.fn().mockRejectedValue(err) })
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)

    await expect(
      orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main'),
    ).rejects.toThrow()

    expect(scanStore.fail).toHaveBeenCalledWith('scan-id-1', expect.any(String))
  })

  // 5. fetches tree and scans files
  it('fetches tree and scans files', async () => {
    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(codeRepo.fetchTree).toHaveBeenCalledWith('owner/repo', 'sha123')
    expect(codeRepo.fetchFileContent).toHaveBeenCalledWith('owner/repo', 'file-sha-1')
  })

  // 6. upserts findings and auto-resolves stale vulns
  it('upserts findings and auto-resolves stale vulns', async () => {
    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(vulnStore.upsertMany).toHaveBeenCalled()
    expect(vulnStore.autoResolveStale).toHaveBeenCalledWith(
      'org-1',
      'scan-id-1',
      expect.any(Array),
    )
  })

  // 7. calls AI analyzer for paid plans
  it('calls AI analyzer for paid plans', async () => {
    // Use vulnerable code that triggers a SQL injection finding via the sql-concat check:
    // pattern: /(?:query|execute|raw)\s*\(\s*[`"'].*?\$\{|(?:query|execute|raw)\s*\(\s*['"].*?\+\s*(?:req\.|params\.|body\.|args)/gim
    const vulnerableContent = `db.query("SELECT * FROM users WHERE id = " + req.body.id)`
    codeRepo = makeCodeRepo({
      fetchFileContent: vi.fn().mockResolvedValue(vulnerableContent),
    })
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)

    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(aiAnalyzer.analyzeBatch).toHaveBeenCalled()
  })

  // 8. skips AI for free plans
  it('skips AI for free plans', async () => {
    billing = makeBilling({
      getPlan: vi.fn().mockResolvedValue({ type: 'free', includesAi: false, includesDetails: false, scanLimit: null }),
    })
    orchestrator = new ScanOrchestrator(codeRepo, scanStore, vulnStore, aiAnalyzer, billing)

    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(aiAnalyzer.analyzeBatch).not.toHaveBeenCalled()
  })

  // 9. completes scan with score and summary
  it('completes scan with score and summary', async () => {
    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(scanStore.complete).toHaveBeenCalledWith(
      'scan-id-1',
      'A', // clean code → score A
      expect.objectContaining({ critical: 0, high: 0, medium: 0, low: 0, info: 0 }),
      expect.any(Number),
    )
  })

  // 10. records scan usage after completion
  it('records scan usage after completion', async () => {
    await orchestrator.runCodeScan('org-1', 'user-1', 'owner/repo', 'main')

    expect(billing.recordScan).toHaveBeenCalledWith('org-1')
  })
})
