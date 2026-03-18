import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import Link from 'next/link'
import { DailyLearningSpark } from '@/components/learning-spark/DailyLearningSpark'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch patient count
  const { count: totalPatients } = await supabase
    .from('patient_histories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .is('deleted_at', null)

  // Fetch analysis count
  const { count: totalAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  // Fetch this month's patient count
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: thisMonthCount } = await supabase
    .from('patient_histories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', startOfMonth.toISOString())
    .is('deleted_at', null)

  // Fetch recent patients with latest analysis risk_level
  const { data: recentPatients } = await supabase
    .from('patient_histories')
    .select('id, patient_name, status, created_at, analyses(risk_level, analysis_version, created_at)')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  const getLatestRiskLevel = (analyses: Array<{ risk_level: string; analysis_version: string | null; created_at: string }> | null) => {
    if (!analyses || analyses.length === 0) return null
    const clinical = analyses.filter(a => a.analysis_version !== 'discharge')
    if (clinical.length === 0) return null
    const sorted = [...clinical].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted[0].risk_level
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Patients</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalPatients || 0}</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Analyses Done</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalAnalyses || 0}</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
              <span className="text-2xl">🔬</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{thisMonthCount || 0}</p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome card */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-2xl font-bold mb-2">Welcome to MedFlow AI</h3>
        <p className="text-blue-50 mb-4">
          Your subscription-based medical patient history analysis platform.
        </p>
        <Link href="/dashboard/patients/new">
          <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors">
            Add New Patient
          </button>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Patients</h3>
        </div>
        <div className="p-6">
          {!recentPatients || recentPatients.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No patients yet. Add your first patient to get started!</p>
          ) : (
            <div className="space-y-3">
              {recentPatients.map((patient) => {
                const riskLevel = getLatestRiskLevel(patient.analyses as Array<{ risk_level: string; analysis_version: string | null; created_at: string }> | null)
                const triage = getTriageFromRiskLevel(riskLevel)
                const showProcessingBadge = patient.status !== 'completed'

                return (
                  <Link
                    key={patient.id}
                    href={`/dashboard/patients/${patient.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{patient.patient_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(patient.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {triage ? (
                          <Badge variant={getTriageBadgeVariant(triage)}>
                            {getTriageLabel(triage)}
                          </Badge>
                        ) : showProcessingBadge ? (
                          <Badge variant={patient.status === 'analyzing' ? 'warning' : patient.status === 'draft' ? 'info' : patient.status === 'error' ? 'danger' : 'default'}>
                            {patient.status}
                          </Badge>
                        ) : (
                          <Badge variant="default">Unassessed</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Daily Learning Spark */}
      <DailyLearningSpark />
    </div>
  )
}
