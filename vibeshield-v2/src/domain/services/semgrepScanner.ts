import { execFile } from 'child_process'
import { mkdtemp, writeFile, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import crypto from 'crypto'
import type { CodeFinding } from './codeScanner'
import type { FileContent } from '@/domain/ports/codeRepository'

// ── Category mapping ────────────────────────────────────────────────────────

const CATEGORY_MAP: Array<[RegExp, string]> = [
  [/sqli|sql.injection/i, 'SQL Injection'],
  [/xss|cross.site.scripting/i, 'XSS'],
  [/command.injection|os.command/i, 'Command Injection'],
  [/path.traversal/i, 'Path Traversal'],
  [/ssrf/i, 'SSRF'],
  [/deserialization/i, 'Insecure Deserialization'],
  [/crypto|weak.hash/i, 'Weak Cryptography'],
  [/auth|session/i, 'Authentication'],
  [/hardcoded.secret|password/i, 'Hardcoded Secret'],
  [/xxe/i, 'XXE'],
  [/open.redirect/i, 'Open Redirect'],
  [/cors/i, 'CORS Misconfiguration'],
]

export function guessCategory(checkId: string): string {
  for (const [pattern, category] of CATEGORY_MAP) {
    if (pattern.test(checkId)) return category
  }
  return 'Code vulnerability'
}

// ── Severity mapping ────────────────────────────────────────────────────────

function mapSeverity(semgrepSeverity: string): CodeFinding['severity'] {
  switch (semgrepSeverity.toUpperCase()) {
    case 'ERROR':
      return 'high'
    case 'WARNING':
      return 'medium'
    case 'INFO':
      return 'low'
    default:
      return 'medium'
  }
}

// ── Semgrep result types ────────────────────────────────────────────────────

interface SemgrepResult {
  check_id: string
  path: string
  start: { line: number; col: number }
  end: { line: number; col: number }
  extra: {
    message: string
    severity: string
    lines: string
    fix?: string
    metadata?: {
      cwe?: string[]
      owasp?: string[]
    }
  }
}

interface SemgrepOutput {
  results: SemgrepResult[]
  errors: unknown[]
}

// ── Main function ───────────────────────────────────────────────────────────

export async function runSemgrep(files: FileContent[]): Promise<CodeFinding[]> {
  if (files.length === 0) return []

  let tmpDir: string | undefined
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'vs-semgrep-'))

    // Write files to temp dir
    for (const file of files) {
      const filePath = join(tmpDir, file.path)
      const dir = filePath.substring(0, filePath.lastIndexOf('/'))
      await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }))
      await writeFile(filePath, file.content, 'utf8')
    }

    // Run Semgrep
    const output = await runSemgrepBinary(tmpDir)
    if (!output) return []

    const parsed: SemgrepOutput = JSON.parse(output)

    return parsed.results.map((r): CodeFinding => {
      const location = `${r.path.replace(tmpDir + '/', '')}:${r.start.line}`
      const locationHash = crypto
        .createHash('sha256')
        .update(`${location}:${r.check_id}`)
        .digest('hex')
        .slice(0, 16)

      return {
        id: `semgrep-${crypto.randomBytes(4).toString('hex')}`,
        checkId: r.check_id,
        locationHash,
        title: r.extra.message.slice(0, 200),
        description: r.extra.message,
        fix: r.extra.fix ?? 'Review and fix the identified vulnerability.',
        category: guessCategory(r.check_id),
        severity: mapSeverity(r.extra.severity),
        location,
        codeSnippet: (r.extra.lines ?? '').slice(0, 200),
        source: 'Semgrep',
      }
    })
  } catch {
    return []
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

function runSemgrepBinary(targetDir: string): Promise<string | null> {
  return new Promise(resolve => {
    execFile(
      'semgrep',
      ['scan', '--config', 'p/owasp-top-ten', '--config', 'p/nodejs', '--json', '--quiet', targetDir],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          resolve(null) // Semgrep not installed
          return
        }
        // Semgrep returns exit code 1 when findings exist — that's OK
        resolve(stdout || null)
      },
    )
  })
}

// ── Deduplication ───────────────────────────────────────────────────────────

export function deduplicateFindings(regexFindings: CodeFinding[], semgrepFindings: CodeFinding[]): CodeFinding[] {
  const semgrepKeys = new Set(semgrepFindings.map(f => `${f.location}|${f.category}`))
  const filtered = regexFindings.filter(f => !semgrepKeys.has(`${f.location}|${f.category}`))
  return [...semgrepFindings, ...filtered]
}
