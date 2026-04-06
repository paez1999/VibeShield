import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { randomBytes } from 'crypto'

// List webhooks for the org
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
      .from('webhooks').select('id, repo_full_name, active, created_at')
      .eq('org_id', user.orgId).order('created_at', { ascending: false })
    if (error) return jsonError('Failed to fetch webhooks', 500)
    return jsonOk(data)
  } catch (err) { return handleApiError(err) }
}

// Register a new webhook
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { repo } = await req.json()
    if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      return jsonError('Invalid repo format (owner/repo)', 400)
    }

    const secret = randomBytes(32).toString('hex')
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase.from('webhooks').upsert({
      org_id: user.orgId,
      repo_full_name: repo,
      secret,
    }, { onConflict: 'org_id,repo_full_name' }).select('id, repo_full_name, secret, active').single()

    if (error) return jsonError('Failed to create webhook', 500)
    return jsonOk(data, 201)
  } catch (err) { return handleApiError(err) }
}
