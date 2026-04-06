import type { Vulnerability, NewVulnerability, SeveritySummary, Severity, VulnStatus } from '../entities/vulnerability'
import type { PaginationOpts, Paginated } from './scanStore'

export interface VulnFilters {
  status?: VulnStatus
  severity?: Severity
  category?: string
  scanId?: string
}

export interface VulnStore {
  upsertMany(vulns: NewVulnerability[]): Promise<number>
  listByOrg(orgId: string, filters: VulnFilters, opts: PaginationOpts): Promise<Paginated<Vulnerability>>
  summaryByOrg(orgId: string): Promise<SeveritySummary>
  resolve(id: string, userId: string): Promise<void>
  ignore(id: string, userId: string): Promise<void>
  autoResolveStale(orgId: string, scanId: string, currentLocationHashes: string[]): Promise<number>
}
