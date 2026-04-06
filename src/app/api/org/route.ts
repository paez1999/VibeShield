import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase.from('orgs').select('*').eq('id', user.orgId).single()
    if (error || !data) return jsonError('Organization not found', 404)
    return jsonOk(data)
  } catch (err) { return handleApiError(err) }
}
