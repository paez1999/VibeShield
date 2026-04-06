import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

const BulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['resolve', 'ignore']),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = BulkSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid request', 400)

    const { ids, action } = parsed.data
    const supabase = await createSupabaseServer()
    const newStatus = action === 'resolve' ? 'resolved' : 'ignored'

    const { error, count } = await supabase
      .from('vulnerabilities')
      .update({ status: newStatus })
      .in('id', ids)
      .eq('org_id', user.orgId)

    if (error) return jsonError('Failed to update vulnerabilities', 500)
    return jsonOk({ updated: count ?? ids.length })
  } catch (err) { return handleApiError(err) }
}
