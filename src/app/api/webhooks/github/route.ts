import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseServer } from '@/lib/supabase/server'
import { jsonOk, jsonError } from '@/lib/api-utils'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const computed = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-hub-signature-256') || ''
    const event = req.headers.get('x-github-event') || ''

    // Only process push events
    if (event !== 'push') return jsonOk({ ignored: true })

    const payload = JSON.parse(body)
    const repoFullName = payload.repository?.full_name
    if (!repoFullName) return jsonError('Missing repository info', 400)

    const supabase = await createSupabaseServer()

    // Look up webhook by repo name
    const { data: webhook } = await supabase
      .from('webhooks').select('id, org_id, secret, active')
      .eq('repo_full_name', repoFullName).eq('active', true).single()

    if (!webhook) return jsonOk({ ignored: true, reason: 'no matching webhook' })

    // Verify HMAC signature
    if (!verifySignature(body, signature, webhook.secret)) {
      return jsonError('Invalid signature', 401)
    }

    // Get the branch from the ref
    const ref = payload.ref?.replace('refs/heads/', '') || 'main'

    // Create a scan record asynchronously
    const { data: scan } = await supabase.from('scans').insert({
      org_id: webhook.org_id,
      user_id: null,
      repo: repoFullName,
      ref,
      type: 'code',
      status: 'queued',
      progress: { total: 0, scanned: 0, findings: 0 },
    }).select('id').single()

    // Return 200 immediately — the scan will be picked up by Cloud Functions
    return jsonOk({ received: true, scanId: scan?.id })
  } catch {
    return jsonOk({ received: true })
  }
}
