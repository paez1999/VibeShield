import type { SupabaseClient } from '@supabase/supabase-js'
import type { Org, PlanType } from '../../domain/entities/org'
import type { OrgStore } from '@/domain/ports/orgStore'

export class SupabaseOrgStore implements OrgStore {
  constructor(private readonly db: SupabaseClient) {}

  async getById(id: string): Promise<Org | null> {
    const { data, error } = await this.db.from('orgs').select('*').eq('id', id).maybeSingle()

    if (error) throw error
    if (!data) return null
    return this.toOrg(data)
  }

  async decrementTrialScans(id: string): Promise<void> {
    const { error } = await this.db.rpc('decrement_trial_scans', { p_org_id: id })
    if (error) throw error
  }

  async updatePlan(id: string, plan: PlanType): Promise<void> {
    const { error } = await this.db.from('orgs').update({ plan }).eq('id', id)
    if (error) throw error
  }

  private toOrg(row: Record<string, unknown>): Org {
    return {
      id: row.id as string,
      name: row.name as string,
      plan: row.plan as PlanType,
      trialScansRemaining: row.trial_scans_remaining as number,
      stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
      stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
    }
  }
}
