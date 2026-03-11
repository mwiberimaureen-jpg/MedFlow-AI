'use client'

import { DischargeSummaryResponse } from '@/lib/types/patient'

interface DischargeSummaryViewProps {
  summary: DischargeSummaryResponse
  patientName: string
  dischargeDate?: string
}

export function DischargeSummaryView({ summary, patientName, dischargeDate }: DischargeSummaryViewProps) {
  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 print:border-black">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white print:text-black">Discharge Summary</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Patient: {patientName} {dischargeDate && `| Discharged: ${new Date(dischargeDate).toLocaleDateString()}`}
        </p>
      </div>

      {/* Diagnoses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 print:bg-white print:border print:border-gray-300">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1">Admission Diagnosis</h3>
          <p className="text-gray-900 dark:text-white font-medium">{summary.admission_diagnosis}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 print:bg-white print:border print:border-gray-300">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 uppercase tracking-wider mb-1">Discharge Diagnosis</h3>
          <p className="text-gray-900 dark:text-white font-medium">{summary.discharge_diagnosis}</p>
        </div>
      </div>

      {/* Condition at Discharge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Condition at Discharge:</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 capitalize">
          {summary.condition_at_discharge}
        </span>
      </div>

      {/* Hospital Course */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hospital Course</h3>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{summary.hospital_course}</p>
      </div>

      {/* Procedures */}
      {summary.procedures_performed && summary.procedures_performed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Procedures Performed</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            {summary.procedures_performed.map((proc, i) => (
              <li key={i}>{proc}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Discharge Medications */}
      {summary.discharge_medications && summary.discharge_medications.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Discharge Medications</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Drug</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Dose</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Route</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Frequency</th>
                  <th className="text-left py-2 font-semibold text-gray-700 dark:text-gray-300">Duration</th>
                </tr>
              </thead>
              <tbody>
                {summary.discharge_medications.map((med, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{med.drug}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{med.dose}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{med.route}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{med.frequency}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{med.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Follow-up Appointments */}
      {summary.follow_up && summary.follow_up.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Follow-up Appointments</h3>
          <div className="space-y-2">
            {summary.follow_up.map((fu, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 print:bg-white print:border">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{fu.specialty}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{fu.reason}</p>
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{fu.when}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tests */}
      {summary.tests_pending && summary.tests_pending.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Pending Tests / Results to Follow Up</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            {summary.tests_pending.map((test, i) => (
              <li key={i}>{test}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Patient Instructions */}
      {summary.patient_instructions && summary.patient_instructions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Patient Instructions</h3>
          <ul className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
            {summary.patient_instructions.map((instruction, i) => (
              <li key={i}>{instruction}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Print button */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 no-print">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          Print Discharge Summary
        </button>
      </div>
    </div>
  )
}
