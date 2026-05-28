import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWardRoundNote } from '@/lib/openrouter/client'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: patient } = await supabase
    .from('patient_histories')
    .select('history_text')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const note = await generateWardRoundNote(patient.history_text)

  // Cache on the admission analysis so it loads instantly on future page visits
  await supabase
    .from('analyses')
    .update({ user_feedback: note })
    .eq('patient_history_id', id)
    .eq('analysis_version', 'admission')
    .eq('user_id', user.id)

  return NextResponse.json({ note })
}
