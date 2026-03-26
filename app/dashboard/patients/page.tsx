import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PatientsList } from '@/components/patients/PatientsList'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patient_histories')
    .select('*, analyses(risk_level, analysis_version, created_at)')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

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
        <PatientsList patients={patients} />
      )}

    </div>
  )
}
