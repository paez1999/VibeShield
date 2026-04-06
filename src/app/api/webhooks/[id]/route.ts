import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()
    const { error } = await supabase.from('webhooks').delete()
      .eq('id', id).eq('org_id', user.orgId)
    if (error) return jsonError('Failed to delete webhook', 500)
    return jsonOk({ deleted: true })
  } catch (err) { return handleApiError(err) }
}
