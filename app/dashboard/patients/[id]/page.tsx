export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { AnalyzeButton } from '@/components/patients/AnalyzeButton'
import { AdmissionTimeline } from '@/components/patients/AdmissionTimeline'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { AnalysisPoller } from '@/components/patients/AnalysisPoller'
import Link from 'next/link'
import { DeletePatientButton } from '@/components/patients/DeletePatientButton'
import { StarPatientButton } from '@/components/patients/StarPatientButton'
import { decryptField } from '@/lib/crypto/field-encryption'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patient, error } = await supabase
    .from('patient_histories')
    .select(`
      *,
      analyses (
        *,
        todo_items (*)
      )
    `)
    .eq('id', id)
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .single()

  if (error || !patient) {
    notFound()
  }

  // Decrypt PII fields
  patient.patient_name = decryptField(patient.patient_name)
  if (patient.patient_identifier) patient.patient_identifier = decryptField(patient.patient_identifier)

  // Sort analyses chronologically by created_at
  const sortedAnalyses = (patient.analyses || []).sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const hasAnalyses = sortedAnalyses.length > 0
  const isDischarged = patient.metadata?.admission_status === 'discharged'

  // Get triage from latest analysis
  const latestAnalysis = sortedAnalyses.length > 0 ? sortedAnalyses[sortedAnalyses.length - 1] : null
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div>
        <Link
          href="/dashboard/patients"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Patients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{patient.patient_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {patient.patient_age && <span>Age: {patient.patient_age}</span>}
              {patient.patient_gender && (
                <span>Gender: {patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1)}</span>
              )}
              {patient.patient_identifier && <span>ID: {patient.patient_identifier}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDischarged && <Badge variant="success">Discharged</Badge>}
            {triage ? (
              <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
            ) : patient.status !== 'completed' ? (
              <Badge variant={patient.status === 'analyzing' ? 'warning' : patient.status === 'draft' ? 'info' : patient.status === 'error' ? 'danger' : 'default'}>
                {patient.status}
              </Badge>
            ) : null}
            {patient.status === 'draft' && (
              <Link
                href={`/dashboard/patients/${id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Draft
              </Link>
            )}
            <StarPatientButton patientId={id} initialStarred={!!patient.is_starred} size="md" />
            <DeletePatientButton patientId={id} patientName={patient.patient_name} variant="icon" />
          </div>
        </div>
      </div>

      {/* Patient History */}
      <Card header={{
        title: 'Patient History',
        subtitle: `Created on ${new Date(patient.created_at).toLocaleDateString()}`
      }}>
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {patient.history_text}
          </div>
        </div>
        {patient.word_count && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            Word count: {patient.word_count}
          </div>
        )}
      </Card>

      {/* Analysis / Admission Workflow Section */}
      {!hasAnalyses && patient.status !== 'analyzing' && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Analysis Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Run AI analysis to generate clinical insights and action items
            </p>
            <AnalyzeButton patientId={id} />
          </div>
        </Card>
      )}

      {patient.status === 'analyzing' && (
        <>
          <AnalysisPoller patientId={id} />
          <Card>
            <div className="text-center py-8">
              <div className="text-4xl mb-4 animate-pulse">⚡</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Generating Admission Analysis…
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                AI is analyzing the patient history. This page will update automatically when ready.
              </p>
              <div className="mt-4 flex justify-center">
                <div className="h-1 w-48 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Admission Timeline — shown once at least one analysis exists */}
      {hasAnalyses && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Admission Workflow</h2>
          <AdmissionTimeline
            patient={{
              id: patient.id,
              patient_name: patient.patient_name,
              metadata: patient.metadata,
              status: patient.status
            }}
            initialAnalyses={sortedAnalyses}
          />
        </div>
      )}
    </div>
  )
}
