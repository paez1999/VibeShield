import { NextRequest } from 'next/server'
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return jsonError('Not authenticated', 401)

    const { data: existing } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (existing) return jsonOk({ orgId: existing.org_id, created: false })

    const admin = createSupabaseAdmin()
    const body = await req.json().catch(() => ({}))
    const orgName = body.orgName || user.email?.split('@')[0] || 'My Org'

    const { data: org, error: orgError } = await admin
      .from('orgs').insert({ name: orgName }).select('id').single()
    if (orgError) return jsonError('Failed to create organization', 500)

    const { error: memberError } = await admin
      .from('org_members').insert({ user_id: user.id, org_id: org.id, role: 'admin' })
    if (memberError) return jsonError('Failed to create membership', 500)

    return jsonOk({ orgId: org.id, created: true }, 201)
  } catch (err) { return handleApiError(err) }
}
