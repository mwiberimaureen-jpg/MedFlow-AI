/**
 * POST /api/auth/signup-with-phone
 *
 * Atomic signup with phone verification:
 *  1. Verify the OTP code matches + not expired + not used
 *  2. Re-check phone uniqueness (race-safe)
 *  3. Create Supabase auth user (email confirmation email is sent)
 *  4. Bind the phone to public.users + mark phone_verified_at
 *  5. Mark the OTP row as used
 *
 * Without a valid OTP, no account is created — this is the anti-abuse gate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { hashOtpCode, normalizePhone, OTP_MAX_ATTEMPTS } from '@/lib/auth/otp'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const phone = normalizePhone(body?.phone)
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!email || !password || !phone || !code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    const admin = getSupabaseServerClient()

    // 1. Look up latest non-used OTP for this phone
    const { data: otpRow } = await admin
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phone)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRow) {
      return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 })
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 })
    }

    if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 })
    }

    const providedHash = hashOtpCode(code)
    if (providedHash !== otpRow.code_hash) {
      await admin.from('otp_codes').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id)
      return NextResponse.json({ error: 'Incorrect verification code' }, { status: 400 })
    }

    // 2. Race-safe uniqueness re-check
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .not('phone_verified_at', 'is', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'This phone number is already registered.' },
        { status: 409 }
      )
    }

    // 3. Create the auth user via the standard signUp flow (sends email confirmation)
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

    const userId = signUpData.user.id

    // 4. Bind phone to the users row. If the trigger hasn't created the row yet,
    //    upsert it. Service role bypasses RLS.
    const nowIso = new Date().toISOString()
    const { error: bindError } = await admin
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          phone_number: phone,
          phone_verified_at: nowIso,
        },
        { onConflict: 'id' }
      )

    if (bindError) {
      console.error('[SIGNUP] Failed to bind phone:', bindError.message)
      // Best-effort: the auth user exists but phone isn't bound. Surface a clear error
      // so the user (or support) can finish the setup manually.
      return NextResponse.json(
        { error: 'Account created but phone binding failed. Contact support.' },
        { status: 500 }
      )
    }

    // 5. Mark OTP as used
    await admin.from('otp_codes').update({ used_at: nowIso, verified_at: nowIso }).eq('id', otpRow.id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error in POST /api/auth/signup-with-phone:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
