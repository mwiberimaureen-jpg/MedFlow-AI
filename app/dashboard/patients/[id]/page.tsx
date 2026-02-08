import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { AnalyzeButton } from '@/components/patients/AnalyzeButton'
import { AnalysisPanel } from '@/components/patients/AnalysisPanel'
import Link from 'next/link'

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

  // Get the latest analysis (analyses are ordered by created_at desc in the query)
  const latestAnalysis = patient.analyses && patient.analyses.length > 0
    ? patient.analyses[0]
    : null

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
      completed: 'success',
      analyzing: 'warning',
      draft: 'info',
      error: 'danger'
    }
    return variants[status] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div>
        <Link
          href="/dashboard/patients"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Patients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{patient.patient_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              {patient.patient_age && <span>Age: {patient.patient_age}</span>}
              {patient.patient_gender && (
                <span>Gender: {patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1)}</span>
              )}
              {patient.patient_identifier && <span>ID: {patient.patient_identifier}</span>}
            </div>
          </div>
          <Badge variant={getStatusBadge(patient.status)}>
            {patient.status}
          </Badge>
        </div>
      </div>

      {/* Patient History */}
      <Card header={{
        title: 'Patient History',
        subtitle: `Created on ${new Date(patient.created_at).toLocaleDateString()}`
      }}>
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-gray-700">
            {patient.history_text}
          </div>
        </div>
        {patient.word_count && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
            Word count: {patient.word_count}
          </div>
        )}
      </Card>

      {/* Analysis Section */}
      {!latestAnalysis && patient.status !== 'analyzing' && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Analysis Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Run AI analysis to generate clinical insights and action items
            </p>
            <AnalyzeButton patientId={id} />
          </div>
        </Card>
      )}

      {patient.status === 'analyzing' && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-4 animate-pulse">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Analysis in Progress
            </h3>
            <p className="text-gray-600">
              Please wait while we analyze the patient history...
            </p>
          </div>
        </Card>
      )}

      {latestAnalysis && (
        <AnalysisPanel analysis={latestAnalysis} />
      )}
    </div>
  )
}
