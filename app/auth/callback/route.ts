import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

async function generateUniqueCode(admin: ReturnType<typeof getSupabaseServerClient>): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const { data } = await admin.from('users').select('id').eq('referral_code', code).maybeSingle()
    if (!data) return code
  }
  return String(Date.now()).slice(-4)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const admin = getSupabaseServerClient()
      const userId = sessionData.user.id
      const meta = sessionData.user.user_metadata || {}

      // Update display name if provided via OAuth
      if (meta.display_name) {
        await supabase
          .from('users')
          .update({ full_name: meta.display_name })
          .eq('id', userId)
          .is('full_name', null)
      }

      // Ensure user has a referral code; record referred_by if they used one at signup
      const { data: userRow } = await admin
        .from('users')
        .select('referral_code, referred_by')
        .eq('id', userId)
        .maybeSingle()

      const updates: Record<string, string> = {}

      if (!userRow?.referral_code) {
        updates.referral_code = await generateUniqueCode(admin)
      }

      const usedCode = (meta.referral_code_used as string | undefined)?.trim().toUpperCase()
      if (usedCode && !userRow?.referred_by) {
        const { data: referrer } = await admin
          .from('users')
          .select('id')
          .eq('referral_code', usedCode)
          .neq('id', userId)
          .maybeSingle()
        if (referrer) updates.referred_by = usedCode
      }

      if (Object.keys(updates).length > 0) {
        await admin.from('users').update(updates).eq('id', userId)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
