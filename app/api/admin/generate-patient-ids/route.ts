/**
 * POST /api/admin/generate-patient-ids
 * Assigns a MF-format 10-character ID to every patient that doesn't have one.
 */

import { NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { encryptField } from '@/lib/crypto/field-encryption'

export const dynamic = 'force-dynamic'

function generatePatientId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const suffix = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `MF${suffix}`
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all active patients belonging to this user that have no identifier
  const { data: patients, error: fetchError } = await supabase
    .from('patient_histories')
    .select('id')
    .eq('user_id', user.id)
    .is('patient_identifier', null)
    .is('deleted_at', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!patients || patients.length === 0) {
    return NextResponse.json({ message: 'All patients already have IDs.', updated: 0 })
  }

  const adminClient = await getSupabaseServerClient()
  let updated = 0
  let failed = 0

  for (const patient of patients) {
    const newId = generatePatientId()
    const { error: updateError } = await adminClient
      .from('patient_histories')
      .update({ patient_identifier: encryptField(newId) })
      .eq('id', patient.id)

    if (updateError) {
      failed++
    } else {
      updated++
    }
  }

  const message = failed > 0
    ? `Generated IDs for ${updated} patients. ${failed} failed.`
    : `Generated IDs for ${updated} patient${updated !== 1 ? 's' : ''}.`

  return NextResponse.json({ message, updated, failed })
}
