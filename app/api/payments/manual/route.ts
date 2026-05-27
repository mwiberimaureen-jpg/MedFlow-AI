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

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MedFlow AI Payments <onboarding@resend.dev>',
          to: 'medflowai.ke@gmail.com',
          subject: 'Mpesa Code',
          html: `
            <p style="font-family:sans-serif;font-size:15px">
              <strong>M-Pesa Code:</strong>
              <span style="font-size:20px;font-weight:bold;letter-spacing:2px"> ${code}</span>
            </p>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin-top:8px">
              <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Name</td><td>${fullName || 'N/A'}</td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Email</td><td>${email || user.email}</td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Plan</td><td>${plan.label}</td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Amount</td><td>KES ${plan.amount.toLocaleString()}</td></tr>
            </table>
          `,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Manual payment error:', error)
    return NextResponse.json({ error: 'Failed to submit payment. Please try again.' }, { status: 500 })
  }
}
