import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Create org if first login
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .single()

        if (!existing) {
          // Call our API to create org (uses admin client)
          await fetch(`${request.nextUrl.origin}/api/auth/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; '),
            },
            body: JSON.stringify({ orgName: user.email?.split('@')[0] || 'My Org' }),
          })
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Auth error — redirect to auth page
  return NextResponse.redirect(new URL('/auth', request.url))
}
