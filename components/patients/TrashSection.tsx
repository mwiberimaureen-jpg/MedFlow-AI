'use client'

import { RestorePatientButton } from './RestorePatientButton'
import { PermanentDeleteButton } from './PermanentDeleteButton'

interface TrashedPatient {
  id: string
  patient_name: string
  deleted_at: string
}

interface TrashSectionProps {
  patients: TrashedPatient[]
}

export function TrashSection({ patients }: TrashSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-red-200 dark:border-red-900/30">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <span className="text-lg">🗑️</span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trash</h3>
        {patients.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">({patients.length})</span>
        )}
      </div>
      <div className="p-6">
        {patients.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-center text-sm py-2">Trash is empty. Deleted patients will appear here for 7 days.</p>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => {
              const deletedDate = new Date(patient.deleted_at)
              const expiresDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000)
              const daysLeft = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))

              return (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{patient.patient_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Deleted {deletedDate.toLocaleDateString()} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RestorePatientButton patientId={patient.id} />
                    <PermanentDeleteButton patientId={patient.id} patientName={patient.patient_name} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
