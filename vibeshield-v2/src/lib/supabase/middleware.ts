import { createSupabaseServer } from './server'

export interface AuthUser {
  id: string
  email: string
  orgId: string | null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    orgId: membership?.org_id ?? null,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) throw new Error('UNAUTHORIZED')
  if (!user.orgId) throw new Error('NO_ORG')
  return user
}
