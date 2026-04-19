/**
 * API Route: Star/Unstar Patient History
 * POST /api/patients/[id]/star - Toggle retention (starred histories bypass auto-delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logger'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const starred = body?.starred === true

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('patient_histories')
      .update({ is_starred: starred })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    logAuditEvent({
      userId: user.id,
      action: starred ? 'patient.star' : 'patient.unstar',
      resourceType: 'patient',
      resourceId: id,
      request,
    })

    return NextResponse.json({ ok: true, is_starred: starred })
  } catch (error: any) {
    console.error('Error in POST /api/patients/[id]/star:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
