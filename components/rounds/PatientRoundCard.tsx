'use client'

import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractObgynData,
  extractPatientNameFromHistory,
  extractPatientAgeFromHistory,
  extractSectionFromAnalysis,
} from '@/lib/utils/rounds-parser'

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
  analysisCount: number
}

function extractImpression(rawText: string): string {
  if (!rawText) return ''
  try {
    const parsed = JSON.parse(rawText)
    if (Array.isArray(parsed.impressions) && parsed.impressions.length > 0) {
      return parsed.impressions
        .map((imp: any, i: number) => `${i + 1}. ${imp.diagnosis || imp.impression || imp}`)
        .join('\n')
    }
    if (typeof parsed.impression === 'string' && parsed.impression) return parsed.impression
  } catch { /* not JSON */ }
  const match = rawText.match(/##\s*Impression\s*([\s\S]*?)(?=\n##\s|$)/i)
  if (match?.[1]) {
    return match[1].trim().replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-•]\s*/gm, '• ').trim()
  }
  return ''
}

function extractSuggestedPlan(rawText: string): string {
  if (!rawText) return ''

  const parts: string[] = []

  try {
    const parsed = JSON.parse(rawText)
    const plan = parsed?.management_plan
    if (plan) {
      if (Array.isArray(plan.recommended_plan) && plan.recommended_plan.length > 0) {
        const steps = plan.recommended_plan.map((s: any, i: number) => `${i + 1}. ${s.step || s}`)
        parts.push(steps.join('\n'))
      }
      const adj = plan.adjustments_based_on_status?.trim()
      if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) {
        parts.push(`Adjustments: ${adj}`)
      }
    }
  } catch {
    const mgmt = extractSectionFromAnalysis(rawText, 'management_plan')
    if (mgmt) parts.push(mgmt)
  }

  const confirmatory = extractSectionFromAnalysis(rawText, 'confirmatory_tests')
  if (confirmatory) {
    parts.push(`Follow-up tests:\n${confirmatory}`)
  }

  return parts.join('\n\n')
}

export function PatientRoundCard({ patient, latestAnalysis, allAnalyses, analysisCount }: PatientRoundCardProps) {
  const dayOfAdmission = calculateDayOfAdmission(patient.created_at)
  const obgyn = extractObgynData(patient.history_text, patient.patient_gender)
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  // Name + age with fallback extraction from history text
  const displayName = patient.patient_name || extractPatientNameFromHistory(patient.history_text) || 'Patient'
  const displayAge = patient.patient_age || extractPatientAgeFromHistory(patient.history_text)

  const demoLine: string[] = []
  if (displayAge) demoLine.push(`${displayAge}y`)
  if (patient.patient_gender) demoLine.push(patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1))
  if (obgyn.obstetricFormula) demoLine.push(obgyn.obstetricFormula)
  demoLine.push(`Day ${dayOfAdmission} of Admission`)

  // Most recent day note (user_feedback) — this is the full formatted round note
  // submitted by the clinician (HPI narrative → ROS → Vitals → PE → Investigations → PLAN)
  const latestDayNote = allAnalyses
    .filter(a => a.analysis_version?.startsWith('day_') && a.user_feedback?.trim())
    .sort((a, b) => {
      const da = parseInt(a.analysis_version?.replace('day_', '') || '0', 10)
      const db = parseInt(b.analysis_version?.replace('day_', '') || '0', 10)
      return db - da
    })[0]?.user_feedback || ''

  // Fall back to the brief admission summary when no day note exists yet
  const mainBody = latestDayNote || latestAnalysis?.summary || ''

  // AI assessment sections (from the latest analysis raw text)
  const impression = latestAnalysis ? extractImpression(latestAnalysis.raw_analysis_text) : ''
  const suggestedPlan = latestAnalysis ? extractSuggestedPlan(latestAnalysis.raw_analysis_text) : ''
  const hasAiAssessment = !!(impression || suggestedPlan)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {displayName}
            {patient.patient_identifier && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({patient.patient_identifier})</span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{demoLine.join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          {triage ? (
            <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
          ) : (
            <Badge variant="default">Unassessed</Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Round note body: full day note if available, else admission summary */}
        {mainBody ? (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{mainBody}</p>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">
            No analysis available yet — submit the admission history to generate a summary.
          </p>
        )}

        {/* AI Assessment: Impression + Suggested Plan */}
        {hasAiAssessment && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">AI Assessment</p>
            {impression && (
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Impression</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{impression}</p>
              </div>
            )}
            {suggestedPlan && (
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Suggested Plan</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{suggestedPlan}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
