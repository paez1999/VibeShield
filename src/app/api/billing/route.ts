import { NextRequest } from 'next/server'
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import Stripe from 'stripe'

let _stripe: Stripe | undefined
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return _stripe
}

// GET /api/billing — plan status
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data: org } = await supabase.from('orgs')
      .select('plan, trial_scans_remaining, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.orgId).single()
    if (!org) return jsonError('Organization not found', 404)
    return jsonOk({
      plan: org.plan,
      trialScansRemaining: org.trial_scans_remaining,
      hasSubscription: !!org.stripe_subscription_id,
    })
  } catch (err) { return handleApiError(err) }
}

// POST /api/billing — create checkout session
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data: org } = await supabase.from('orgs')
      .select('id, stripe_customer_id').eq('id', user.orgId).single()
    if (!org) return jsonError('Organization not found', 404)

    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email, metadata: { orgId: org.id },
      })
      customerId = customer.id
      const admin = createSupabaseAdmin()
      await admin.from('orgs').update({ stripe_customer_id: customerId }).eq('id', org.id)
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID
    if (!priceId) return jsonError('Billing not configured', 503)
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/dashboard/billing`,
      metadata: { orgId: org.id },
    })

    return jsonOk({ url: session.url })
  } catch (err) { return handleApiError(err) }
}
