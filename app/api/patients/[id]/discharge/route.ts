/**
 * API Route: Discharge Patient
 * PATCH /api/patients/[id]/discharge
 *
 * Sets metadata.admission_status = 'discharged' and metadata.discharge_date.
 * Updates patient status to 'completed'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

        // Fetch patient to verify ownership
        const { data: patient, error: patientError } = await supabase
            .from('patient_histories')
            .select('id, user_id, metadata')
            .eq('id', id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single()

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
        }

        const dischargeDate = new Date().toISOString()
        const updatedMetadata = {
            ...(patient.metadata || {}),
            admission_status: 'discharged',
            discharge_date: dischargeDate
        }

        const { error: updateError } = await supabase
            .from('patient_histories')
            .update({
                status: 'completed',
                metadata: updatedMetadata
            })
            .eq('id', id)
            .eq('user_id', user.id)

        if (updateError) {
            console.error('Error discharging patient:', updateError)
            return NextResponse.json({ error: 'Failed to discharge patient' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            discharge_date: dischargeDate
        })

    } catch (error: any) {
        console.error('Error in PATCH /api/patients/[id]/discharge:', error)
        return NextResponse.json(
            { error: 'Failed to discharge patient', message: error.message },
            { status: 500 }
        )
    }
}
