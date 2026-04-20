/**
 * POST /api/auth/signup-with-phone
 *
 * Firebase-backed signup: the browser has already completed phone OTP
 * verification with Firebase and holds a signed ID token. We verify that
 * token server-side, extract the verified phone number, enforce uniqueness,
 * then create the Supabase account and bind the phone.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { normalizePhone } from '@/lib/auth/otp'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const firebaseIdToken = typeof body?.firebaseIdToken === 'string' ? body.firebaseIdToken : ''

    if (!email || !password || !firebaseIdToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // 1. Verify Firebase ID token — this proves the browser completed OTP
    //    verification for the phone number carried in the token.
    let decoded
    try {
      decoded = await getAdminAuth().verifyIdToken(firebaseIdToken)
    } catch (err: any) {
      console.error('[SIGNUP] Firebase token verification failed:', err?.message)
      return NextResponse.json({ error: 'Invalid or expired verification. Please try again.' }, { status: 401 })
    }

    const phone = normalizePhone(decoded.phone_number || '')
    if (!phone) {
      return NextResponse.json({ error: 'Phone number missing from verification' }, { status: 400 })
    }

    const admin = getSupabaseServerClient()

    // 2. Uniqueness check — one phone, one account
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .not('phone_verified_at', 'is', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'This phone number is already registered. Please sign in instead.' },
        { status: 409 }
      )
    }

    // 3. Create the Supabase auth user via standard signUp (sends email confirmation)
    const origin = new URL(request.url).origin
    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    const { data: signUpData, error: signUpError } = await anon.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/dashboard` },
    })

    if (signUpError || !signUpData?.user) {
      return NextResponse.json(
        { error: signUpError?.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    // 4. Bind the verified phone to the users row (service role bypasses RLS)
    const nowIso = new Date().toISOString()
    const { error: bindError } = await admin
      .from('users')
      .upsert(
        { id: signUpData.user.id, email, phone_number: phone, phone_verified_at: nowIso },
        { onConflict: 'id' }
      )

    if (bindError) {
      console.error('[SIGNUP] Failed to bind phone:', bindError.message)
      return NextResponse.json(
        { error: 'Account created but phone binding failed. Contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error in POST /api/auth/signup-with-phone:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
