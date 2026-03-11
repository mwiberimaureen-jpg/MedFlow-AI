import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import Link from 'next/link'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patient_histories')
    .select('*, analyses(risk_level, analysis_version, created_at)')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const getLatestRiskLevel = (analyses: Array<{ risk_level: string; analysis_version: string | null; created_at: string }> | null) => {
    if (!analyses || analyses.length === 0) return null
    // Filter out discharge analyses — they don't have clinical triage risk levels
    const clinical = analyses.filter(a => a.analysis_version !== 'discharge')
    if (clinical.length === 0) return null
    const sorted = [...clinical].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted[0].risk_level
  }

  const renderTriageBadge = (patient: any) => {
    const riskLevel = getLatestRiskLevel(patient.analyses)
    const triage = getTriageFromRiskLevel(riskLevel)

    if (triage) {
      return <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
    }
    if (patient.status === 'analyzing') return <Badge variant="warning">Analyzing</Badge>
    if (patient.status === 'draft') return <Badge variant="info">Draft</Badge>
    if (patient.status === 'error') return <Badge variant="danger">Error</Badge>
    return <Badge variant="default">Unassessed</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Patient Histories</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">Manage and analyze your patient histories</p>
        </div>
        <Link href="/dashboard/patients/new">
          <button className="bg-blue-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm md:text-base">
            Add New
          </button>
        </Link>
      </div>

      {!patients || patients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Patient Histories Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Get started by adding your first patient history for AI-powered analysis
          </p>
          <Link href="/dashboard/patients/new">
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Add Your First Patient
            </button>
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: compact clickable list */}
          <div className="md:hidden space-y-2">
            {patients.map((patient) => (
              <Link
                key={patient.id}
                href={`/dashboard/patients/${patient.id}`}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {patient.patient_identifier || patient.patient_name}
                  </p>
                  {patient.patient_identifier && patient.patient_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{patient.patient_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {renderTriageBadge(patient)}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Triage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{patient.patient_name}</div>
                      {patient.patient_identifier && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{patient.patient_identifier}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {patient.patient_age || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {patient.patient_gender || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderTriageBadge(patient)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(patient.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/patients/${patient.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
