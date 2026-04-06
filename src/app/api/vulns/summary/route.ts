import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase.rpc('vuln_summary_by_org', { p_org_id: user.orgId })
    if (error) return jsonError('Failed to fetch summary', 500)
    return jsonOk(data ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 })
  } catch (err) { return handleApiError(err) }
}
