export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PatientHistoryForm } from '@/components/patients/PatientHistoryForm'
import { decryptField } from '@/lib/crypto/field-encryption'
import Link from 'next/link'

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patient, error } = await supabase
    .from('patient_histories')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .single()

  if (error || !patient) notFound()

  // Only drafts are editable
  if (patient.status !== 'draft') {
    redirect(`/dashboard/patients/${id}`)
  }

  const initialData = {
    patient_name: decryptField(patient.patient_name),
    patient_age: patient.patient_age ? String(patient.patient_age) : '',
    patient_gender: patient.patient_gender || '',
    patient_identifier: patient.patient_identifier ? decryptField(patient.patient_identifier) : '',
    history_text: patient.history_text || '',
    rotation: patient.metadata?.rotation || '',
    ai_consent: patient.metadata?.ai_consent || false,
    third_party_consent: patient.metadata?.third_party_consent || false,
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <Link
          href={`/dashboard/patients/${id}`}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Patient
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Draft</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Update the patient history, then save as draft or submit for analysis.
        </p>
      </div>

      <PatientHistoryForm patientId={id} initialData={initialData} />
    </div>
  )
}
