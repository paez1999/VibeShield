export const PLAN_TYPES = ['trial', 'free', 'pro', 'team'] as const
export type PlanType = (typeof PLAN_TYPES)[number]

export interface Org {
  id: string
  name: string
  plan: PlanType
  trialScansRemaining: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  createdAt: Date
}

export interface Plan {
  type: PlanType
  includesAi: boolean
  includesDetails: boolean
  scanLimit: number | null
}

export const PLAN_CONFIG: Record<PlanType, Omit<Plan, 'type'>> = {
  trial: { includesAi: true, includesDetails: true, scanLimit: 3 },
  free: { includesAi: false, includesDetails: false, scanLimit: null },
  pro: { includesAi: true, includesDetails: true, scanLimit: null },
  team: { includesAi: true, includesDetails: true, scanLimit: null },
}
