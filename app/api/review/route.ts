import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { rating, feedback, userEmail, userName, context } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
    }

    const admin = getSupabaseServerClient()

    // Save review to database
    await admin.from('reviews').insert({
      user_id: user?.id ?? null,
      email: userEmail ?? null,
      name: userName ?? null,
      rating,
      feedback: feedback?.trim() || null,
      context: context ?? 'trial',
    })

    // Mark review as submitted on the user record (unlocks analyses 4 & 5 for trial users)
    if (user?.id) {
      await admin
        .from('users')
        .update({ review_submitted: true })
        .eq('id', user.id)
    }

    // Send email notification via Resend (only if API key is configured)
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
      const label = context === 'paid' ? 'Subscriber' : 'Trial user'

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MedFlow AI Reviews <onboarding@resend.dev>',
          to: 'medflowai.ke@gmail.com',
          subject: `${stars} Review from ${userEmail ?? 'a user'}`,
          html: `
            <h2 style="font-family:sans-serif">New MedFlow AI Review</h2>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">From</td><td>${userName ?? 'Anonymous'} &lt;${userEmail ?? 'unknown'}&gt;</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Type</td><td>${label}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Rating</td><td style="font-size:20px">${stars} (${rating}/5)</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">Feedback</td><td>${feedback?.trim() || '<em>No written feedback</em>'}</td></tr>
            </table>
          `,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
