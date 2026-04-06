import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import Stripe from 'stripe'

let _stripe: Stripe | undefined
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return _stripe
}

// POST /api/billing/portal — create customer portal session
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data: org } = await supabase.from('orgs')
      .select('stripe_customer_id').eq('id', user.orgId).single()

    if (!org?.stripe_customer_id) {
      return jsonError('No billing account found. Subscribe first.', 400)
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/dashboard/billing`,
    })

    return jsonOk({ url: session.url })
  } catch (err) { return handleApiError(err) }
}
