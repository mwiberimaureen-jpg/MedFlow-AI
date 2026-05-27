import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLAN_CONFIG = {
  basic: { amount: 1000, label: 'Basic (20 patients/month)' },
  pro:   { amount: 2000, label: 'Pro (50 patients/month)' },
} as const

const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbyCsycmveSdn7MvOLz__pWBnhEyXhO7DGBmNAq0aLB8s0KOeBw2AC4rrNA-1Cuz7LKg7g/exec'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { mpesaCode, email, fullName, planType = 'basic', referralCode, useCredit } = await request.json()

    if (!mpesaCode?.trim()) {
      return NextResponse.json({ error: 'M-Pesa confirmation code is required' }, { status: 400 })
    }

    const plan = PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.basic
    const admin = getSupabaseServerClient()
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const code = mpesaCode.trim().toUpperCase()

    // Effective amount: 25% off only when the buyer has an earned referral credit.
    // Entering someone else's referral code does NOT give the buyer a discount —
    // it only credits the referrer when they subscribe.
    let effectiveAmount: number = plan.amount
    let referrerId: string | null = null

    if (referralCode?.trim()) {
      // Validate code and record the referrer — no price change for the buyer
      const refCode = referralCode.trim().toUpperCase()
      const { data: referrer } = await admin
        .from('users')
        .select('id')
        .eq('referral_code', refCode)
        .neq('id', user.id)
        .maybeSingle()

      if (referrer) {
        referrerId = referrer.id
      }
    } else if (useCredit) {
      // Check user actually has credits
      const { data: userRow } = await admin
        .from('users')
        .select('referral_credits')
        .eq('id', user.id)
        .single()

      if ((userRow?.referral_credits ?? 0) > 0) {
        effectiveAmount = Math.round(plan.amount * 0.75)
      }
    }

    // Activate subscription immediately
    await Promise.all([
      admin.from('subscriptions').insert({
        user_id: user.id,
        status: 'active',
        plan_type: planType,
        amount: effectiveAmount,
        currency: 'KES',
        payment_provider: 'mpesa_manual',
        starts_at: now,
        expires_at: expiresAt,
        metadata: {
          mpesa_code: code,
          ...(referralCode ? { referral_code_used: referralCode.trim().toUpperCase() } : {}),
          ...(useCredit && !referralCode ? { referral_credit_used: true } : {}),
        },
      }),
      admin.from('users').update({
        subscription_status: 'active',
        subscription_expires_at: expiresAt,
      }).eq('id', user.id),
    ])

    // Record referral: give referrer a credit; decrement buyer's credit if used
    if (referrerId) {
      const { data: referrerRow } = await admin
        .from('users').select('referral_count, referral_credits').eq('id', referrerId).single()
      await admin.from('users').update({
        referral_count:   (referrerRow?.referral_count  ?? 0) + 1,
        referral_credits: (referrerRow?.referral_credits ?? 0) + 1,
      }).eq('id', referrerId)
    }

    if (useCredit && !referralCode) {
      const { data: buyerRow } = await admin
        .from('users').select('referral_credits').eq('id', user.id).single()
      await admin.from('users').update({
        referral_credits: Math.max(0, (buyerRow?.referral_credits ?? 1) - 1),
      }).eq('id', user.id)
    }

    // Log to Google Sheet
    await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fullName || 'N/A',
        email: email || user.email,
        plan: plan.label,
        amount: `KES ${effectiveAmount.toLocaleString()}${effectiveAmount < plan.amount ? ' (25% off)' : ''}`,
        code,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Manual payment error:', error)
    return NextResponse.json({ error: 'Failed to submit payment. Please try again.' }, { status: 500 })
  }
}
