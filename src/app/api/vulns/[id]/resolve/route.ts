import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()
    const { error } = await supabase.from('vulnerabilities').update({
      status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id,
    }).eq('id', id)
    if (error) return jsonError('Failed to resolve vulnerability', 500)
    return jsonOk({ ok: true })
  } catch (err) { return handleApiError(err) }
}
