import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { mpesaCode, email, fullName } = await request.json()

    if (!mpesaCode?.trim()) {
      return NextResponse.json({ error: 'M-Pesa confirmation code is required' }, { status: 400 })
    }

    const admin = getSupabaseServerClient()

    // Save pending payment record
    await admin.from('subscriptions').insert({
      user_id: user.id,
      status: 'pending',
      plan_type: 'monthly',
      amount: 1000,
      currency: 'KES',
      payment_provider: 'mpesa_manual',
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { mpesa_code: mpesaCode.trim().toUpperCase() },
    })

    // Email notification to admin
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
          subject: `New M-Pesa Payment — ${mpesaCode.trim().toUpperCase()}`,
          html: `
            <h2 style="font-family:sans-serif">New Manual M-Pesa Payment</h2>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">From</td><td>${fullName || 'N/A'} &lt;${email || user.email}&gt;</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">M-Pesa Code</td><td style="font-weight:bold;font-size:16px">${mpesaCode.trim().toUpperCase()}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Amount</td><td>KES 1,000</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">User ID</td><td>${user.id}</td></tr>
            </table>
            <p style="font-family:sans-serif;margin-top:16px">
              Verify in your M-Pesa statement, then activate in Supabase:<br/>
              Set <code>subscription_status = 'active'</code> on the <strong>users</strong> table for this user.
            </p>
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
