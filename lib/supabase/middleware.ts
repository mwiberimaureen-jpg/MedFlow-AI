import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads the JWT from the cookie without a Supabase network call,
  // which keeps middleware fast enough for Vercel's edge timeout.
  // IMPORTANT: we intentionally do NOT redirect authenticated users away from
  // /login or /signup here. getSession() cannot verify whether the stored JWT
  // is still valid on Supabase's side (it may be expired or revoked). If we
  // bounce a "session-cookie-present" user to /dashboard and the dashboard
  // layout's getUser() then finds no valid user, the result is an infinite
  // redirect loop ("too many redirects" on mobile). Let the login/signup pages
  // and auth callbacks handle post-login navigation instead.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Guard /dashboard routes — gate on cookie presence only (fast path).
  // The dashboard layout does the authoritative getUser() check and will
  // redirect to /login if the session turns out to be invalid.
  if (
    !session &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
