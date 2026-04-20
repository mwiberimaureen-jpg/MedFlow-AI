/**
 * API Route: Trial Status
 * GET /api/auth/trial-status - Return current user's trial quota for UI display
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrialQuota } from '@/lib/billing/trial'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quota = await getTrialQuota(supabase, user.id)
    return NextResponse.json(quota)
  } catch (error: any) {
    console.error('Error in GET /api/auth/trial-status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trial status' },
      { status: 500 }
    )
  }
}
