import { NextRequest } from 'next/server'
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const supabase = await createSupabaseServer()

    // Only allow updating specific fields
    const allowed: Record<string, any> = {}
    if ('slack_webhook_url' in body) allowed.slack_webhook_url = body.slack_webhook_url || null
    if ('github_token' in body) allowed.github_token = body.github_token || null
    if ('name' in body && typeof body.name === 'string') allowed.name = body.name.trim()

    if (Object.keys(allowed).length === 0) return jsonError('No valid fields to update', 400)

    const { error } = await supabase.from('orgs').update(allowed).eq('id', user.orgId)
    if (error) return jsonError('Failed to update organization', 500)
    return jsonOk({ updated: true })
  } catch (err) { return handleApiError(err) }
}
