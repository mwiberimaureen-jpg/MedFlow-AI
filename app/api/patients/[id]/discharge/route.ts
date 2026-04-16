/**
 * API Route: Discharge Patient
 * PATCH /api/patients/[id]/discharge
 *
 * Sets metadata.admission_status = 'discharged' and metadata.discharge_date.
 * Generates an AI discharge summary and saves it as an analysis record.
 * Updates patient status to 'completed'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDischargeSummary } from '@/lib/openrouter/client'
import { logAuditEvent } from '@/lib/audit/logger'
import { decryptField } from '@/lib/crypto/field-encryption'

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

        // Fetch patient with history text
        const { data: patient, error: patientError } = await supabase
            .from('patient_histories')
            .select('id, user_id, metadata, history_text, patient_name, patient_age, patient_gender, patient_identifier')
            .eq('id', id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single()

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
        }

        // Consent gate: verify patient consent before AI analysis
        const meta = patient.metadata || {}
        if (!meta.ai_consent || !meta.third_party_consent) {
            return NextResponse.json(
                { error: 'Patient consent for AI analysis has not been recorded. Please update consent before generating discharge summary.' },
                { status: 403 }
            )
        }

        // Mark patient as discharged
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

        // Fetch all analyses for discharge summary context
        const { data: allAnalyses } = await supabase
            .from('analyses')
            .select('analysis_version, summary, raw_analysis_text')
            .eq('patient_history_id', id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        const analysisSummaries = (allAnalyses || []).map(a => ({
            version: a.analysis_version || 'admission',
            summary: a.summary,
            rawText: a.raw_analysis_text
        }))

        // Decrypt PII for use in discharge summary
        const patientName = decryptField(patient.patient_name)
        const patientIdentifier = patient.patient_identifier ? decryptField(patient.patient_identifier) : null

        // Generate AI discharge summary
        // Patient identifiers are de-identified before transmission to the AI API
        const startTime = Date.now()
        const dischargeSummary = await generateDischargeSummary(
            patient.history_text,
            analysisSummaries,
            undefined,
            { patientName, patientIdentifier }
        )
        const processingTime = Date.now() - startTime

        // Save discharge summary as an analysis record
        const { error: analysisError } = await supabase
            .from('analyses')
            .insert({
                patient_history_id: id,
                user_id: user.id,
                analysis_version: 'discharge',
                summary: dischargeSummary.summary,
                risk_level: 'low',
                raw_analysis_text: JSON.stringify(dischargeSummary),
                model_used: 'anthropic/claude-sonnet-4',
                processing_time_ms: processingTime,
                total_items: 0,
                completed_items: 0,
                todo_list_json: []
            })

        if (analysisError) {
            console.error('Error saving discharge summary:', analysisError)
            // Don't fail the discharge — it's already done, summary is a bonus
        }

        logAuditEvent({
            userId: user.id,
            action: 'discharge.create',
            resourceType: 'patient',
            resourceId: id,
            metadata: { discharge_date: dischargeDate },
            request,
        })

        return NextResponse.json({
            success: true,
            discharge_date: dischargeDate,
            discharge_summary: dischargeSummary
        })

    } catch (error: any) {
        console.error('Error in PATCH /api/patients/[id]/discharge:', error)
        return NextResponse.json(
            { error: 'Failed to discharge patient' },
            { status: 500 }
        )
    }
}
