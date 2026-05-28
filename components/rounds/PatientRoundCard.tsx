'use client'

import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractObgynData,
  extractPatientNameFromHistory,
  extractPatientAgeFromHistory,
  extractChiefComplaintWithDuration,
  extractHpiDetails,
  extractPMHFromHistory,
  extractVitalsFromHistory,
  extractWeightFromHistory,
  extractTestsFromHistory,
  extractManagementFromHistory,
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
  rotation?: string | null
}

// ── AI section helpers ────────────────────────────────────────────────────────

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
    return match[1].trim().replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-•]\s*/gm, '').trim()
  }
  return ''
}

function extractDifferentials(rawText: string): string {
  if (!rawText) return ''
  try {
    const parsed = JSON.parse(rawText)
    if (Array.isArray(parsed.differential_diagnoses) && parsed.differential_diagnoses.length > 0) {
      return parsed.differential_diagnoses
        .slice(0, 5)
        .map((d: any, i: number) => `${i + 1}. ${d.diagnosis}`)
        .join('\n')
    }
  } catch { /* not JSON */ }
  const match = rawText.match(/##\s*Differential\s+Diagnos\w*\s*([\s\S]*?)(?=\n##\s|$)/i)
  if (match?.[1]) {
    return match[1].trim()
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .split('\n')
      .map(l => l.replace(/^[-•]\s*/, '').trim())
      .filter(l => l.length > 3)
      .slice(0, 5)
      .join('\n')
  }
  return ''
}

function extractAdjustedPlan(rawText: string): string {
  if (!rawText) return ''
  const parts: string[] = []
  try {
    const parsed = JSON.parse(rawText)
    const plan = parsed?.management_plan
    if (plan) {
      if (Array.isArray(plan.recommended_plan) && plan.recommended_plan.length > 0) {
        parts.push(plan.recommended_plan.map((s: any, i: number) => `${i + 1}. ${s.step || s}`).join('\n'))
      }
      const adj = (plan.adjustments_based_on_status || '').trim()
      if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) {
        parts.push(`Adjustments: ${adj}`)
      }
    }
  } catch {
    const mgmt = extractSectionFromAnalysis(rawText, 'management_plan')
    if (mgmt) parts.push(mgmt)
  }
  const confirmatory = extractSectionFromAnalysis(rawText, 'confirmatory_tests')
  if (confirmatory) parts.push(`Follow-up tests:\n${confirmatory}`)
  return parts.join('\n\n')
}

// ── Row helper for the round note ────────────────────────────────────────────

function NoteRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-semibold text-gray-500 dark:text-gray-400 shrink-0 min-w-[120px]">{label}:</span>
      <span className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{value}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PatientRoundCard({
  patient,
  latestAnalysis,
  allAnalyses,
  analysisCount,
  rotation,
}: PatientRoundCardProps) {
  const { history_text, patient_gender, created_at } = patient
  const dayOfAdmission = calculateDayOfAdmission(created_at)
  const obgyn = extractObgynData(history_text, patient_gender)
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  // ── Demographics — ALWAYS from structured fields, never AI text ────────────
  const displayName =
    (patient.patient_name && patient.patient_name.trim()) ||
    extractPatientNameFromHistory(history_text) ||
    'Patient'
  const displayAge = patient.patient_age || extractPatientAgeFromHistory(history_text)
  const isPeds =
    (displayAge !== null && displayAge <= 12) ||
    rotation?.toLowerCase().includes('paediatric') ||
    rotation?.toLowerCase().includes('pediatric')
  const weight = isPeds ? extractWeightFromHistory(history_text) : null

  // Demographics line
  const demoParts: string[] = [displayName]
  if (displayAge) demoParts.push(`${displayAge}y`)
  if (patient_gender) {
    demoParts.push(patient_gender.charAt(0).toUpperCase() + patient_gender.slice(1))
  }
  if (obgyn.lmp) demoParts.push(`LMP: ${obgyn.lmp}`)
  else if (obgyn.gestationalAge) demoParts.push(obgyn.gestationalAge)
  if (obgyn.obstetricFormula) demoParts.push(obgyn.obstetricFormula)
  if (weight) demoParts.push(`Wt: ${weight}`)

  const demographicsLine = `${demoParts.join(', ')} — Day ${dayOfAdmission} of Admission`

  // ── Round note body ────────────────────────────────────────────────────────
  // Prefer the most recent day note (doctor-formatted, already correct).
  // Fall back to structured extraction from history_text for admission-only patients.
  const latestDayNote = allAnalyses
    .filter(a => a.analysis_version?.startsWith('day_') && a.user_feedback?.trim())
    .sort((a, b) => {
      const da = parseInt(a.analysis_version?.replace('day_', '') || '0', 10)
      const db = parseInt(b.analysis_version?.replace('day_', '') || '0', 10)
      return db - da
    })[0]?.user_feedback?.trim() || ''

  // Structured fields extracted directly from history_text (never from AI summary)
  const cc = extractChiefComplaintWithDuration(history_text)
  const hpi = extractHpiDetails(history_text)
  const pmh = extractPMHFromHistory(history_text)
  const vitals = extractVitalsFromHistory(history_text)
  const investigations = extractTestsFromHistory(history_text)
  const currentPlan = extractManagementFromHistory(history_text)

  // ── AI Assessment ─────────────────────────────────────────────────────────
  const impression = latestAnalysis ? extractImpression(latestAnalysis.raw_analysis_text) : ''
  const differentials = latestAnalysis ? extractDifferentials(latestAnalysis.raw_analysis_text) : ''
  const adjustedPlan = latestAnalysis ? extractAdjustedPlan(latestAnalysis.raw_analysis_text) : ''
  const hasAiAssessment = !!(impression || differentials || adjustedPlan)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">

      {/* ── Header ── */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {displayName}
            {patient.patient_identifier && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({patient.patient_identifier})
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{demographicsLine}</p>
        </div>
        <div className="flex items-center gap-2">
          {triage ? (
            <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
          ) : (
            <Badge variant="default">Unassessed</Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* ── Round note body ── */}
        {latestDayNote ? (
          // Day note submitted by doctor — show as-is, already in correct ward round format
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {latestDayNote}
          </p>
        ) : (
          // Admission only — build structured note directly from history_text
          <div className="space-y-1.5">
            <NoteRow label="Chief Complaint" value={cc} />
            <NoteRow label="History" value={hpi} />
            <NoteRow label="PMH / PSH" value={pmh || 'Nil significant'} />
            <NoteRow label="Vital Signs" value={vitals} />
            <NoteRow label="Investigations" value={investigations} />
            <NoteRow label="Current Plan" value={currentPlan} />
            {!cc && !hpi && !vitals && !investigations && !currentPlan && (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No history documented yet.
              </p>
            )}
          </div>
        )}

        {/* ── AI Assessment ── */}
        {hasAiAssessment && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              AI Assessment
            </p>
            {impression && (
              <div className="text-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Impression</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{impression}</p>
              </div>
            )}
            {differentials && (
              <div className="text-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Differentials</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{differentials}</p>
              </div>
            )}
            {adjustedPlan && (
              <div className="text-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Adjusted Plan</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{adjustedPlan}</p>
              </div>
            )}
          </div>
        )}

        {!latestAnalysis && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-700 pt-2">
            No analysis yet — submit the admission history to generate an AI assessment.
          </p>
        )}
      </div>
    </div>
  )
}
