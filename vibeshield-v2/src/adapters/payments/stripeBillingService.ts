import Stripe from 'stripe'
import type { BillingService, CanScanResult } from '@/domain/ports/billingService'
import type { Plan, PlanType } from '@/domain/entities/org'
import type { SupabaseOrgStore } from '@/adapters/db/supabaseOrgStore'

export class StripeBillingService implements BillingService {
  private readonly stripe: Stripe

  constructor(
    stripeSecretKey: string,
    private readonly orgStore: SupabaseOrgStore,
  ) {
    this.stripe = new Stripe(stripeSecretKey)
  }

  async canScan(orgId: string): Promise<CanScanResult> {
    const org = await this.orgStore.getById(orgId)
    if (!org) return { allowed: false, reason: 'Organization not found' }

    if (org.plan === 'trial') {
      if (org.trialScansRemaining > 0) return { allowed: true }
      return { allowed: false, reason: 'Free trial exhausted. Upgrade to continue scanning.' }
    }

    if (org.plan === 'free') {
      return { allowed: true }
    }

    if (org.plan === 'pro' || org.plan === 'team') {
      if (!org.stripeSubscriptionId) {
        return { allowed: false, reason: 'No active subscription found.' }
      }
      try {
        const subscription = await this.stripe.subscriptions.retrieve(org.stripeSubscriptionId)
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          return { allowed: true }
        }
        return { allowed: false, reason: 'Subscription inactive. Please update payment method.' }
      } catch {
        return { allowed: false, reason: 'Could not verify subscription status.' }
      }
    }

    return { allowed: false, reason: 'Unknown plan type' }
  }

  async recordScan(orgId: string): Promise<void> {
    const org = await this.orgStore.getById(orgId)
    if (!org) return

    if (org.plan === 'trial') {
      await this.orgStore.decrementTrialScans(orgId)
    }
  }

  async getPlan(orgId: string): Promise<Plan> {
    const org = await this.orgStore.getById(orgId)
    if (!org) {
      return { type: 'free', includesAi: false, includesDetails: false, scanLimit: null }
    }

    const config: Record<string, Omit<Plan, 'type'>> = {
      trial: { includesAi: true, includesDetails: true, scanLimit: 3 },
      free: { includesAi: false, includesDetails: false, scanLimit: null },
      pro: { includesAi: true, includesDetails: true, scanLimit: null },
      team: { includesAi: true, includesDetails: true, scanLimit: null },
    }

    const planConfig = config[org.plan] ?? config.free
    return { type: org.plan as PlanType, ...planConfig }
  }
}
