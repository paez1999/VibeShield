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

const TriggerScanSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('code'),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    ref: z.string().default('main'),
  }),
  z.object({
    type: z.literal('api'),
    repo: z.string().url(),
  }),
  z.object({
    type: z.literal('text'),
    repo: z.string(),
    ref: z.string(),
  }),
  z.object({
    type: z.literal('deps'),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = TriggerScanSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid scan parameters', 400)

    const supabase = await createSupabaseServer()

    const { data: org } = await supabase
      .from('orgs').select('plan, trial_scans_remaining')
      .eq('id', user.orgId).single()

    if (!org) return jsonError('Organization not found', 404)
    if (org.plan === 'trial' && org.trial_scans_remaining <= 0) {
      return jsonError('Free trial exhausted. Upgrade to continue scanning.', 429)
    }

    const { type, repo } = parsed.data
    const ref = 'ref' in parsed.data ? parsed.data.ref : ''

    const { data: scan, error: scanError } = await supabase
      .from('scans').insert({
        org_id: user.orgId, user_id: user.id, repo, ref, type,
        status: type === 'api' ? 'scanning' : 'queued',
        progress: { total: 0, scanned: 0, findings: 0 },
      }).select('id').single()

    if (scanError) return jsonError('Failed to create scan', 500)

    // API scans run inline (fast, no Cloud Function needed)
    if (type === 'api') {
      const { probeApi } = await import('@/domain/services/apiProber')
      const result = await probeApi(repo)

      if (result.findings.length > 0) {
        const vulns = result.findings.map(f => ({
          org_id: user.orgId,
          scan_id: scan.id,
          check_id: f.checkId,
          location_hash: f.locationHash,
          title: f.title,
          description: f.description,
          category: f.category,
          severity: f.severity,
          status: 'open' as const,
          location: f.location,
          code_snippet: f.codeSnippet,
          fix_prompt: f.fix,
          ai_explanation: null,
          source: f.source,
        }))
        await supabase.from('vulnerabilities').upsert(vulns, { onConflict: 'location_hash,scan_id' })
      }

      const summary = {
        critical: result.findings.filter(f => f.severity === 'critical').length,
        high: result.findings.filter(f => f.severity === 'high').length,
        medium: result.findings.filter(f => f.severity === 'medium').length,
        low: result.findings.filter(f => f.severity === 'low').length,
        info: result.findings.filter(f => f.severity === 'info').length,
      }

      await supabase.from('scans').update({
        status: 'done',
        summary,
        score: Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 3),
      }).eq('id', scan.id)

      return jsonOk({ scanId: scan.id, status: 'done', findings: result.findings.length, endpoints: result.endpoints }, 201)
    }

    return jsonOk({ scanId: scan.id, status: 'queued' }, 201)
  } catch (err) { return handleApiError(err) }
}
