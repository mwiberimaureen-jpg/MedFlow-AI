import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLAN_CONFIG = {
  basic: { amount: 1000, label: 'Basic (20 patients/month)' },
  pro:   { amount: 2000, label: 'Pro (50 patients/month)' },
} as const

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { mpesaCode, email, fullName, planType = 'basic' } = await request.json()

    if (!mpesaCode?.trim()) {
      return NextResponse.json({ error: 'M-Pesa confirmation code is required' }, { status: 400 })
    }

    const plan = PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.basic
    const admin = getSupabaseServerClient()
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const code = mpesaCode.trim().toUpperCase()

    // Activate immediately so the user gets access as soon as they submit their code.
    // The email below lets you verify the M-Pesa code manually on your end.
    await Promise.all([
      admin.from('subscriptions').insert({
        user_id: user.id,
        status: 'active',
        plan_type: planType,
        amount: plan.amount,
        currency: 'KES',
        payment_provider: 'mpesa_manual',
        starts_at: now,
        expires_at: expiresAt,
        metadata: { mpesa_code: code },
      }),
      admin.from('users').update({
        subscription_status: 'active',
        subscription_expires_at: expiresAt,
      }).eq('id', user.id),
    ])

    await fetch('https://script.google.com/macros/s/AKfycbyCsycmveSdn7MvOLz__pWBnhEyXhO7DGBmNAq0aLB8s0KOeBw2AC4rrNA-1Cuz7LKg7g/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName || 'N/A',
          email: email || user.email,
          plan: plan.label,
          amount: `KES ${plan.amount.toLocaleString()}`,
          code,
        }),
      })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Manual payment error:', error)
    return NextResponse.json({ error: 'Failed to submit payment. Please try again.' }, { status: 500 })
  }
}
