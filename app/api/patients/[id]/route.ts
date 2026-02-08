/**
 * API Route: Single Patient History
 * GET /api/patients/[id] - Get patient history with analyses
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    return NextResponse.json({ patient })

  } catch (error: any) {
    console.error('Error in GET /api/patients/[id]:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch patient history',
        message: error.message
      },
      { status: 500 }
    )
  }
}
