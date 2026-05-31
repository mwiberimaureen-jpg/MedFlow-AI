import { createClient } from '@/lib/supabase/server'
import { RoundsView } from '@/components/rounds/RoundsView'
import { decryptField } from '@/lib/crypto/field-encryption'

export default async function RoundsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patient_histories')
    .select('id, patient_name, patient_age, patient_gender, patient_identifier, history_text, status, metadata, created_at, analyses(id, risk_level, raw_analysis_text, summary, user_feedback, analysis_version, created_at)')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const activePatients = (patients || []).filter(
    (p: any) => p.metadata?.admission_status !== 'discharged' && p.status !== 'draft'
  )

  const patientsWithData = activePatients.map((patient: any) => {
    const analyses = (patient.analyses || [])
      .filter((a: any) => a.analysis_version !== 'discharge')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      patient: {
        id: patient.id,
        patient_name: decryptField(patient.patient_name),
        patient_age: patient.patient_age,
        patient_gender: patient.patient_gender,
        patient_identifier: patient.patient_identifier ? decryptField(patient.patient_identifier) : undefined,
        history_text: patient.history_text,
        created_at: patient.created_at,
      },
      rotation: patient.metadata?.rotation || null,
      latestAnalysis: analyses[0] || null,
      allAnalyses: analyses.map((a: any) => ({
        analysis_version: a.analysis_version,
        summary: a.summary,
        user_feedback: a.user_feedback,
        raw_analysis_text: a.raw_analysis_text,
        created_at: a.created_at,
      })),
      analysisCount: analyses.length,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Daily Rounds</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">
          {activePatients.length} active patient{activePatients.length !== 1 ? 's' : ''} — select a rotation to begin
        </p>
      </div>

      <RoundsView patients={patientsWithData} />
    </div>
  )
}
