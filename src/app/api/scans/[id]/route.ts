import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase.from('scans').select('*').eq('id', id).single()
    if (error || !data) return jsonError('Scan not found', 404)
    return jsonOk(data)
  } catch (err) { return handleApiError(err) }
}
