import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    const { data, error, count } = await supabase
      .from('scans').select('*', { count: 'exact' })
      .eq('org_id', user.orgId).order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return jsonError('Failed to fetch scans', 500)
    return jsonOk({ data, total: count ?? 0 })
  } catch (err) { return handleApiError(err) }
}

const TriggerScanSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  ref: z.string().default('main'),
  type: z.enum(['code', 'api', 'text', 'deps']).default('code'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = TriggerScanSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid scan parameters', 400)

    const { repo, ref, type } = parsed.data
    const supabase = await createSupabaseServer()

    const { data: org } = await supabase
      .from('orgs').select('plan, trial_scans_remaining')
      .eq('id', user.orgId).single()

    if (!org) return jsonError('Organization not found', 404)
    if (org.plan === 'trial' && org.trial_scans_remaining <= 0) {
      return jsonError('Free trial exhausted. Upgrade to continue scanning.', 429)
    }

    const { data: scan, error: scanError } = await supabase
      .from('scans').insert({
        org_id: user.orgId, user_id: user.id, repo, ref, type,
        status: 'queued', progress: { total: 0, scanned: 0, findings: 0 },
      }).select('id').single()

    if (scanError) return jsonError('Failed to create scan', 500)
    return jsonOk({ scanId: scan.id, status: 'queued' }, 201)
  } catch (err) { return handleApiError(err) }
}
