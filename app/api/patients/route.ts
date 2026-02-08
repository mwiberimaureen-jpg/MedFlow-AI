/**
 * API Route: Patient Histories
 * GET /api/patients - List user's patient histories
 * POST /api/patients - Create new patient history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreatePatientRequest } from '@/lib/types/patient'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch patient histories for the user
    const { data: patients, error: patientsError } = await supabase
      .from('patient_histories')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (patientsError) {
      console.error('Error fetching patients:', patientsError)
      return NextResponse.json(
        { error: 'Failed to fetch patient histories' },
        { status: 500 }
      )
    }

    return NextResponse.json({ patients })

  } catch (error: any) {
    console.error('Error in GET /api/patients:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch patient histories',
        message: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: CreatePatientRequest = await request.json()
    const { patient_name, patient_age, patient_gender, patient_identifier, history_text, status, metadata } = body

    // Validate required fields
    if (!patient_name || !history_text) {
      return NextResponse.json(
        { error: 'Missing required fields: patient_name and history_text are required' },
        { status: 400 }
      )
    }

    // Validate history_text length
    const historyLength = history_text.trim().length
    if (historyLength < 50) {
      return NextResponse.json(
        { error: 'Patient history must be at least 50 characters long' },
        { status: 400 }
      )
    }

    if (historyLength > 10000) {
      return NextResponse.json(
        { error: 'Patient history must not exceed 10,000 characters' },
        { status: 400 }
      )
    }

    // Create patient history record
    const { data: patient, error: createError } = await supabase
      .from('patient_histories')
      .insert({
        user_id: user.id,
        patient_name: patient_name.trim(),
        patient_age: patient_age || null,
        patient_gender: patient_gender || null,
        patient_identifier: patient_identifier || null,
        history_text: history_text.trim(),
        status: status || 'draft',
        metadata: metadata || null
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating patient history:', createError)
      return NextResponse.json(
        { error: 'Failed to create patient history' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, patient },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Error in POST /api/patients:', error)
    return NextResponse.json(
      {
        error: 'Failed to create patient history',
        message: error.message
      },
      { status: 500 }
    )
  }
}
