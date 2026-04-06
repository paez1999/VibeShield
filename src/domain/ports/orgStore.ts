import type { Org } from '../entities/org'

export interface OrgStore {
  getById(id: string): Promise<Org | null>
  decrementTrialScans(id: string): Promise<void>
  updatePlan(id: string, plan: string): Promise<void>
}
