import type { SeveritySummary } from './vulnerability'

export const SCAN_TYPES = ['code', 'api', 'text', 'deps'] as const
export type ScanType = (typeof SCAN_TYPES)[number]

export const SCAN_STATUSES = ['queued', 'fetching', 'scanning', 'analyzing', 'complete', 'failed'] as const
export type ScanStatus = (typeof SCAN_STATUSES)[number]

export interface ScanProgress {
  total: number
  scanned: number
  findings: number
}

export interface Scan {
  id: string
  orgId: string
  userId: string
  repo: string | null
  ref: string | null
  type: ScanType
  status: ScanStatus
  progress: ScanProgress
  treeSha: string | null
  score: string | null
  summary: SeveritySummary | null
  durationMs: number | null
  error: string | null
  createdAt: Date
  completedAt: Date | null
}
