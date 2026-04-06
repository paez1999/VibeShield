# Plan 4: Stripe Integration — Checkout, Webhooks, Billing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Stripe for payments — create checkout sessions, handle webhook events (subscription lifecycle), and add a billing API route for the frontend to check plan status and create upgrades.

**Architecture:** Stripe Checkout (hosted) for payment collection. Webhooks for subscription lifecycle events. All Stripe logic lives in API routes (server-side only). The frontend never touches the Stripe SDK directly — it just redirects to Checkout URLs.

**Tech Stack:** Stripe SDK (already installed), Next.js API routes, Supabase admin client

**Depends on:** Plan 3 (API routes, auth helper)
**Blocks:** Plan 5 (Frontend billing UI)

---

## File Structure

```
vibeshield-v2/src/app/api/
├── billing/
│   ├── route.ts              # GET: plan status, POST: create checkout session
│   ├── portal/
│   │   └── route.ts          # POST: create Stripe customer portal session
│   └── webhook/
│       └── route.ts          # POST: Stripe webhook handler
```

---

### Task 1: Stripe Webhook Handler

**Files:**
- Create: `vibeshield-v2/src/app/api/billing/webhook/route.ts`

The webhook is the most critical piece — it keeps the database in sync with Stripe.

- [ ] **Step 1: Create webhook route**

Create `src/app/api/billing/webhook/route.ts`:

```typescript
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
        ? session.subscription
        : session.subscription?.id

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
      const { data: orgs } = await admin
        .from('orgs')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .limit(1)

      if (orgs && orgs[0]) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        await admin.from('orgs').update({
          plan: isActive ? 'pro' : 'free',
        }).eq('id', orgs[0].id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: orgs } = await admin
        .from('orgs')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .limit(1)

      if (orgs && orgs[0]) {
        await admin.from('orgs').update({
          plan: 'free',
          stripe_subscription_id: null,
        }).eq('id', orgs[0].id)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id

      if (customerId) {
        console.warn(`[stripe-webhook] Payment failed for customer ${customerId}`)
        // Future: send email notification, set grace period
      }
      break
    }
  }

  return jsonOk({ received: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2 && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/billing/webhook/
git commit -m "feat: add Stripe webhook handler — checkout, subscription lifecycle"
```

---

### Task 2: Billing API Route — Plan Status + Checkout

**Files:**
- Create: `vibeshield-v2/src/app/api/billing/route.ts`

- [ ] **Step 1: Create billing route**

Create `src/app/api/billing/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// GET /api/billing — get current plan status
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const { data: org } = await supabase
      .from('orgs')
      .select('plan, trial_scans_remaining, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.orgId)
      .single()

    if (!org) return jsonError('Organization not found', 404)

    return jsonOk({
      plan: org.plan,
      trialScansRemaining: org.trial_scans_remaining,
      hasSubscription: !!org.stripe_subscription_id,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

// POST /api/billing — create Stripe checkout session
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const { data: org } = await supabase
      .from('orgs')
      .select('id, stripe_customer_id')
      .eq('id', user.orgId)
      .single()

    if (!org) return jsonError('Organization not found', 404)

    // Create or reuse Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { orgId: org.id },
      })
      customerId = customer.id

      // Save customer ID (use admin to bypass RLS for this update)
      const { createSupabaseAdmin } = await import('@/lib/supabase/server')
      const admin = createSupabaseAdmin()
      await admin.from('orgs').update({ stripe_customer_id: customerId }).eq('id', org.id)
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID
    if (!priceId) return jsonError('Billing not configured', 503)

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/dashboard/billing`,
      metadata: { orgId: org.id },
    })

    return jsonOk({ url: session.url })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/billing/route.ts
git commit -m "feat: add billing API — plan status and Stripe checkout session creation"
```

---

### Task 3: Customer Portal Route

**Files:**
- Create: `vibeshield-v2/src/app/api/billing/portal/route.ts`

Stripe Customer Portal lets users manage their subscription (cancel, update payment method) without us building that UI.

- [ ] **Step 1: Create portal route**

Create `src/app/api/billing/portal/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// POST /api/billing/portal — create Stripe customer portal session
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const { data: org } = await supabase
      .from('orgs')
      .select('stripe_customer_id')
      .eq('id', user.orgId)
      .single()

    if (!org?.stripe_customer_id) {
      return jsonError('No billing account found. Subscribe first.', 400)
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/dashboard/billing`,
    })

    return jsonOk({ url: session.url })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/billing/portal/
git commit -m "feat: add Stripe customer portal route for subscription management"
```

---

### Task 4: Update .env.local.example and Verification

**Files:**
- Modify: `vibeshield-v2/.env.local.example`

- [ ] **Step 1: Update env example**

Add Stripe webhook secret to `vibeshield-v2/.env.local.example` if not already there. The file should contain:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRO_PRICE_ID=price_your-pro-plan-price-id

# GitHub (for public scan route)
GITHUB_TOKEN=ghp_your-token
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2
npm test
```

Expected: All 49 tests pass (Stripe routes have no unit tests — they're integration-tested against Stripe).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/.env.local.example
git commit -m "chore: update .env.local.example with Stripe and GitHub vars"
```

---

## Summary

After completing this plan, you have:

1. **Stripe webhook handler** — processes checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed
2. **Billing API** — GET plan status, POST create checkout session (creates Stripe customer if needed)
3. **Customer portal** — POST creates a Stripe portal session URL for subscription management
4. **Updated env example** — all required variables documented

**Billing API Summary:**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/billing` | Yes | Get plan status + trial remaining |
| POST | `/api/billing` | Yes | Create Stripe checkout session → returns URL |
| POST | `/api/billing/portal` | Yes | Create Stripe portal session → returns URL |
| POST | `/api/billing/webhook` | No* | Stripe webhook (signature verified) |

*Webhook uses Stripe signature verification instead of user auth.

**Payment flow:**
1. Frontend calls `POST /api/billing` → gets checkout URL
2. User redirected to Stripe Checkout (hosted)
3. User pays → Stripe sends webhook → our handler updates org plan to 'pro'
4. User redirected back to `/dashboard?upgraded=true`
5. User can manage subscription via `POST /api/billing/portal` → Stripe Portal

**Next plan:**
- Plan 5: Frontend (dashboard, scan page, auth flow, realtime, billing UI)
