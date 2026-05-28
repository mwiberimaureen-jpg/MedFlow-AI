'use client'

import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { calculateDayOfAdmission } from '@/lib/utils/rounds-parser'

interface PatientRoundCardProps {
  patient: {
    id: string
    patient_name: string
    patient_age?: number
    patient_gender?: string
    patient_identifier?: string
    history_text: string
    created_at: string
  }
  latestAnalysis: {
    risk_level: string
    raw_analysis_text: string
    summary: string
    user_feedback?: string | null
    analysis_version?: string | null
  } | null
  allAnalyses: Array<{
    analysis_version: string | null
    summary: string
    user_feedback?: string | null
    created_at: string
  }>
  onClick: () => void
}

export function PatientRoundCard({
  patient,
  latestAnalysis,
  allAnalyses,
  onClick,
}: PatientRoundCardProps) {
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)
  const dayOfAdmission = calculateDayOfAdmission(patient.created_at)

  const noteCount = allAnalyses.filter(
    a => a.user_feedback?.trim() &&
      (a.analysis_version === 'admission' || a.analysis_version?.startsWith('day_'))
  ).length

  const demoParts: string[] = []
  if (patient.patient_age) demoParts.push(`${patient.patient_age}y`)
  if (patient.patient_gender) {
    demoParts.push(
      patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1)
    )
  }
  demoParts.push(`Day ${dayOfAdmission} of Admission`)

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 px-4 py-3 text-left hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {patient.patient_name}
            </h3>
            {patient.patient_identifier && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                ({patient.patient_identifier})
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {demoParts.join(' · ')}
          </p>
          <p className="text-xs mt-1 text-indigo-500 dark:text-indigo-400">
            {noteCount === 0
              ? 'No round notes yet'
              : `${noteCount} round note${noteCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {triage ? (
            <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
          ) : (
            <Badge variant="default">Unassessed</Badge>
          )}
          <svg
            className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  )
}
