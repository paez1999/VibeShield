import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const status = url.searchParams.get('status')
    const severity = url.searchParams.get('severity')
    const category = url.searchParams.get('category')
    const scanId = url.searchParams.get('scanId')

    let query = supabase.from('vulnerabilities').select('*', { count: 'exact' }).eq('org_id', user.orgId)
    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    if (category) query = query.eq('category', category)
    if (scanId) query = query.eq('scan_id', scanId)

    const { data, error, count } = await query
      .order('first_seen_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return jsonError('Failed to fetch vulnerabilities', 500)
    return jsonOk({ data, total: count ?? 0 })
  } catch (err) { return handleApiError(err) }
}
