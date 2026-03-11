import { createClient } from '@/lib/supabase/server'
import { PatientRoundCard } from '@/components/rounds/PatientRoundCard'
import { PrintButton } from '@/components/rounds/PrintButton'

export default async function RoundsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all patients with their analyses
  const { data: patients } = await supabase
    .from('patient_histories')
    .select('id, patient_name, patient_age, patient_gender, patient_identifier, history_text, status, metadata, created_at, analyses(id, risk_level, raw_analysis_text, summary, user_feedback, analysis_version, created_at)')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Filter to active (non-discharged) patients only
  const activePatients = (patients || []).filter(
    (p: any) => p.metadata?.admission_status !== 'discharged' && p.status !== 'draft'
  )

  // For each patient, get the latest analysis
  const patientsWithLatestAnalysis = activePatients.map((patient: any) => {
    const analyses = (patient.analyses || [])
      .filter((a: any) => a.analysis_version !== 'discharge')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      patient: {
        id: patient.id,
        patient_name: patient.patient_name,
        patient_age: patient.patient_age,
        patient_gender: patient.patient_gender,
        patient_identifier: patient.patient_identifier,
        history_text: patient.history_text,
        created_at: patient.created_at,
      },
      latestAnalysis: analyses[0] || null,
      allAnalyses: analyses.map((a: any) => ({
        analysis_version: a.analysis_version,
        summary: a.summary,
        user_feedback: a.user_feedback,
        created_at: a.created_at,
      })),
      analysisCount: analyses.length,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Daily Rounds</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">
            Ward round summaries for {activePatients.length} active patient{activePatients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <PrintButton />
      </div>

      {patientsWithLatestAnalysis.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🏥</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Active Patients</h3>
          <p className="text-gray-600 dark:text-gray-400">
            All patients have been discharged or are still in draft status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {patientsWithLatestAnalysis.map(({ patient, latestAnalysis, allAnalyses, analysisCount }) => (
            <PatientRoundCard
              key={patient.id}
              patient={patient}
              latestAnalysis={latestAnalysis}
              allAnalyses={allAnalyses}
              analysisCount={analysisCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}
