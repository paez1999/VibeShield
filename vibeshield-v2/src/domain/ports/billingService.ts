import type { Plan } from '../entities/org'

export interface CanScanResult {
  allowed: boolean
  reason?: string
}

export interface BillingService {
  canScan(orgId: string): Promise<CanScanResult>
  recordScan(orgId: string): Promise<void>
  getPlan(orgId: string): Promise<Plan>
}
