import type { Scan, ScanStatus, ScanProgress } from '../entities/scan'
import type { SeveritySummary } from '../entities/vulnerability'

export interface PaginationOpts {
  limit: number
  offset: number
}

export interface Paginated<T> {
  data: T[]
  total: number
}

export interface ScanStore {
  create(scan: Omit<Scan, 'id' | 'createdAt' | 'completedAt'>): Promise<string>
  updateStatus(id: string, status: ScanStatus, progress?: Partial<ScanProgress>): Promise<void>
  complete(id: string, score: string, summary: SeveritySummary, durationMs: number): Promise<void>
  fail(id: string, error: string): Promise<void>
  getById(id: string): Promise<Scan | null>
  listByOrg(orgId: string, opts: PaginationOpts): Promise<Paginated<Scan>>
  countByOrgSince(orgId: string, since: Date): Promise<number>
}
