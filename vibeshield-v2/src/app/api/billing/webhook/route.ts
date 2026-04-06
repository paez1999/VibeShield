import { NextRequest } from 'next/server'
import { jsonOk, jsonError } from '@/lib/api-utils'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return jsonError('Missing signature', 400)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return jsonError('Invalid signature', 400)
  }

  const admin = createSupabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const orgId = session.metadata?.orgId
      if (!orgId) break
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription : session.subscription?.id
      await admin.from('orgs').update({
        plan: 'pro',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        trial_scans_remaining: 0,
      }).eq('id', orgId)
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: orgs } = await admin.from('orgs').select('id')
        .eq('stripe_subscription_id', subscription.id).limit(1)
      if (orgs && orgs[0]) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        await admin.from('orgs').update({ plan: isActive ? 'pro' : 'free' }).eq('id', orgs[0].id)
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: orgs } = await admin.from('orgs').select('id')
        .eq('stripe_subscription_id', subscription.id).limit(1)
      if (orgs && orgs[0]) {
        await admin.from('orgs').update({ plan: 'free', stripe_subscription_id: null }).eq('id', orgs[0].id)
      }
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (customerId) console.warn(`[stripe-webhook] Payment failed for customer ${customerId}`)
      break
    }
  }

  return jsonOk({ received: true })
}
