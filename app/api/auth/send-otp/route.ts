/**
 * POST /api/auth/send-otp
 *
 * Generates and sends a 6-digit verification code to the given phone number
 * via SMS (Africa's Talking). Rate-limited + enforces phone uniqueness so a
 * number already bound to an account cannot be used for a second trial.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  generateOtpCode,
  hashOtpCode,
  normalizePhone,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_SENDS_PER_HOUR,
} from '@/lib/auth/otp'
import { sendSms } from '@/lib/sms/africastalking'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const phone = normalizePhone(body?.phone)

    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // 1. Reject if phone already bound to an account (anti-abuse)
    const { data: existing } = await supabase
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

    // 2. Rate limit — block more than N sends per hour per phone
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone_number', phone)
      .gte('created_at', oneHourAgo)

    if ((count ?? 0) >= OTP_MAX_SENDS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many codes sent. Please wait an hour before trying again.' },
        { status: 429 }
      )
    }

    // 3. Generate + store hashed code
    const code = generateOtpCode()
    const codeHash = hashOtpCode(code)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({ phone_number: phone, code_hash: codeHash, expires_at: expiresAt })

    if (insertError) {
      console.error('[OTP] Failed to insert code:', insertError.message)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    // 4. Send SMS
    const sms = await sendSms(
      phone,
      `Your MedFlow AI verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
    )

    if (!sms.ok) {
      console.error('[OTP] SMS send failed:', sms.errorMessage)
      return NextResponse.json({ error: 'Failed to send SMS. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, expiresInMinutes: OTP_EXPIRY_MINUTES })
  } catch (error: any) {
    console.error('Error in POST /api/auth/send-otp:', error)
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 })
  }
}
