/**
 * API Route: Single Patient History
 * GET /api/patients/[id] - Get patient history with analyses
 * DELETE /api/patients/[id] - Soft delete (move to trash) or permanent delete
 * PATCH /api/patients/[id] - Restore from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logger'
import { decryptPatientPII, encryptField } from '@/lib/crypto/field-encryption'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch patient history with analyses and todo items
    const { data: patient, error: patientError } = await supabase
      .from('patient_histories')
      .select(`
        *,
        analyses (
          *,
          todo_items (*)
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient history not found' },
        { status: 404 }
      )
    }

    logAuditEvent({ userId: user.id, action: 'patient.view', resourceType: 'patient', resourceId: id, request })

    return NextResponse.json({ patient: decryptPatientPII(patient) })

  } catch (error: any) {
    console.error('Error in GET /api/patients/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patient history' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    if (permanent) {
      // Permanent delete — remove analyses and todo items first, then patient
      const { data: patient } = await supabase
        .from('patient_histories')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }

      // Delete todo items via analyses
      const { data: analyses } = await supabase
        .from('analyses')
        .select('id')
        .eq('patient_history_id', id)

      if (analyses && analyses.length > 0) {
        const analysisIds = analyses.map(a => a.id)
        await supabase.from('todo_items').delete().in('analysis_id', analysisIds)
        await supabase.from('analyses').delete().eq('patient_history_id', id)
      }

      // Delete the patient record
      const { error: deleteError } = await supabase
        .from('patient_histories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to permanently delete patient' }, { status: 500 })
      }

      logAuditEvent({ userId: user.id, action: 'patient.permanent_delete', resourceType: 'patient', resourceId: id, request })

      return NextResponse.json({ message: 'Patient permanently deleted' })
    } else {
      // Soft delete — move to trash
      const { error: updateError } = await supabase
        .from('patient_histories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 })
      }

      logAuditEvent({ userId: user.id, action: 'patient.delete', resourceType: 'patient', resourceId: id, request })

      return NextResponse.json({ message: 'Patient moved to trash' })
    }
  } catch (error: any) {
    console.error('Error in DELETE /api/patients/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (body.action === 'restore') {
      const { error: updateError } = await supabase
        .from('patient_histories')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to restore patient' }, { status: 500 })
      }

      logAuditEvent({ userId: user.id, action: 'patient.restore', resourceType: 'patient', resourceId: id, request })

      return NextResponse.json({ message: 'Patient restored' })
    }

    // Update rotation (stored in metadata JSONB)
    if (body.rotation !== undefined) {
      // Fetch current metadata to merge
      const { data: patient, error: fetchError } = await supabase
        .from('patient_histories')
        .select('metadata')
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (fetchError || !patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }

      const updatedMetadata = { ...(patient.metadata || {}), rotation: body.rotation || null }

      const { data: updated, error: updateError } = await supabase
        .from('patient_histories')
        .update({ metadata: updatedMetadata })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update rotation' }, { status: 500 })
      }

      logAuditEvent({ userId: user.id, action: 'patient.update', resourceType: 'patient', resourceId: id, metadata: { rotation: body.rotation }, request })

      return NextResponse.json({ patient: updated })
    }

    // Edit draft — full field update (action === 'edit' or body contains draft fields)
    if (body.action === 'edit' || body.patient_name !== undefined || body.history_text !== undefined) {
      const { data: existing, error: fetchError } = await supabase
        .from('patient_histories')
        .select('id, status, metadata')
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'Patient history not found' }, { status: 404 })
      }

      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Only draft histories can be edited' }, { status: 400 })
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }

      if (body.patient_name !== undefined) updates.patient_name = encryptField(body.patient_name.trim())
      if (body.patient_age !== undefined) updates.patient_age = body.patient_age ? parseInt(body.patient_age) : null
      if (body.patient_gender !== undefined) updates.patient_gender = body.patient_gender || null
      if (body.patient_identifier !== undefined) {
        updates.patient_identifier = body.patient_identifier?.trim()
          ? encryptField(body.patient_identifier.trim())
          : null
      }
      if (body.history_text !== undefined) {
        updates.history_text = body.history_text.trim()
        updates.word_count = body.history_text.trim().split(/\s+/).filter(Boolean).length
      }
      if (body.metadata !== undefined) {
        updates.metadata = { ...(existing.metadata || {}), ...body.metadata }
      }
      // Allow promoting draft → analyzing when the user hits Submit & Analyze on the edit form
      if (body.status === 'analyzing') updates.status = 'analyzing'

      const { data: updated, error: updateError } = await supabase
        .from('patient_histories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating draft:', updateError)
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
      }

      logAuditEvent({
        userId: user.id,
        action: 'patient.update',
        resourceType: 'patient_history',
        resourceId: id,
        metadata: { fields_updated: Object.keys(updates).filter(k => k !== 'updated_at') },
        request,
      })

      return NextResponse.json({ patient: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in PATCH /api/patients/[id]:', error)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
  }
}
