/**
 * API Route: Accept Terms
 * POST /api/auth/accept-terms - Record the current user's acceptance of the T&C.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { TERMS_VERSION } from '@/lib/legal/terms'
import { logAuditEvent } from '@/lib/audit/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const version = typeof body?.version === 'string' ? body.version : null

    if (version !== TERMS_VERSION) {
      return NextResponse.json(
        { error: 'Terms version mismatch — please refresh and try again' },
        { status: 400 }
      )
    }

    const acceptedAt = new Date().toISOString()
    const admin = getSupabaseServerClient()

    // Try update first; fall back to upsert so a missing row is never the blocker.
    const { error: updateError } = await admin
      .from('users')
      .upsert({
        id: user.id,
        terms_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
      }, { onConflict: 'id' })

    if (updateError) {
      // If the column doesn't exist yet (migration not run), log it but don't
      // hard-fail — the layout already handles this gracefully.
      console.error('Error recording terms acceptance:', updateError)
      if (!updateError.message?.includes('column') && !updateError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Failed to record acceptance' },
          { status: 500 }
        )
      }
    }

    logAuditEvent({
      userId: user.id,
      action: 'terms.accept',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { version: TERMS_VERSION, accepted_at: acceptedAt },
      request,
    })

    return NextResponse.json({ success: true, version: TERMS_VERSION, accepted_at: acceptedAt })
  } catch (error: any) {
    console.error('Error in POST /api/auth/accept-terms:', error)
    return NextResponse.json(
      { error: 'Failed to record acceptance' },
      { status: 500 }
    )
  }
}
