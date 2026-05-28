'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractObgynData,
  extractPatientNameFromHistory,
  extractPatientAgeFromHistory,
  extractWeightFromHistory,
} from '@/lib/utils/rounds-parser'
import { extractSectionFromAnalysis } from '@/lib/utils/rounds-parser'

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

// ── AI Assessment helpers ─────────────────────────────────────────────────────

function extractImpression(rawText: string): string {
  if (!rawText) return ''
  try {
    const parsed = JSON.parse(rawText)
    if (Array.isArray(parsed.impressions) && parsed.impressions.length > 0) {
      return parsed.impressions
        .map((imp: any, i: number) => `${i + 1}. ${imp.diagnosis || imp.impression || imp}`)
        .join('\n')
    }
  } catch { /* not JSON */ }
  const match = rawText.match(/##\s*Impression\s*([\s\S]*?)(?=\n##\s|$)/i)
  if (match?.[1]) return match[1].trim().replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-•]\s*/gm, '').trim()
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
      .split('\n').map((l: string) => l.replace(/^[-•]\s*/, '').trim()).filter((l: string) => l.length > 3)
      .slice(0, 5).join('\n')
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
      if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) parts.push(`Adjustments: ${adj}`)
    }
  } catch {
    const mgmt = extractSectionFromAnalysis(rawText, 'management_plan')
    if (mgmt) parts.push(mgmt)
  }
  const confirmatory = extractSectionFromAnalysis(rawText, 'confirmatory_tests')
  if (confirmatory) parts.push(`Follow-up tests:\n${confirmatory}`)
  return parts.join('\n\n')
}

// ── Main component ────────────────────────────────────────────────────────────

export function PatientRoundCard({
  patient,
  latestAnalysis,
  allAnalyses,
  rotation,
}: PatientRoundCardProps) {
  const { history_text, patient_gender, created_at } = patient
  const dayOfAdmission = calculateDayOfAdmission(created_at)
  const obgyn = extractObgynData(history_text, patient_gender)
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  // ── Demographics — always from structured fields, never AI text ────────────
  const displayName =
    (patient.patient_name?.trim()) ||
    extractPatientNameFromHistory(history_text) ||
    'Patient'
  const displayAge = patient.patient_age || extractPatientAgeFromHistory(history_text)
  const isPeds =
    (displayAge !== null && displayAge <= 12) ||
    rotation?.toLowerCase().includes('paediatric') ||
    rotation?.toLowerCase().includes('pediatric')
  const weight = isPeds ? extractWeightFromHistory(history_text) : null

  const demoParts: string[] = [displayName]
  if (displayAge) demoParts.push(`${displayAge}y`)
  if (patient_gender) demoParts.push(patient_gender.charAt(0).toUpperCase() + patient_gender.slice(1))
  if (obgyn.lmp) demoParts.push(`LMP: ${obgyn.lmp}`)
  else if (obgyn.gestationalAge) demoParts.push(obgyn.gestationalAge)
  if (obgyn.obstetricFormula) demoParts.push(obgyn.obstetricFormula)
  if (weight) demoParts.push(`Wt: ${weight}`)
  const demographicsLine = `${demoParts.join(', ')} — Day ${dayOfAdmission} of Admission`

  // ── Ward round note (cached on admission analysis user_feedback) ───────────
  const admissionAnalysis = allAnalyses.find(a => a.analysis_version === 'admission')
  const [wardRoundNote, setWardRoundNote] = useState<string>(
    admissionAnalysis?.user_feedback?.trim() || ''
  )
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/patients/${patient.id}/round-note`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Generation failed')
      }
      const { note } = await res.json()
      setWardRoundNote(note)
    } catch (err: any) {
      setGenError(err?.message || 'Failed to generate note')
    } finally {
      setGenerating(false)
    }
  }

  // ── Most recent day note (current status) ─────────────────────────────────
  const latestDayNote = allAnalyses
    .filter(a => a.analysis_version?.startsWith('day_') && a.user_feedback?.trim())
    .sort((a, b) => {
      const da = parseInt(a.analysis_version?.replace('day_', '') || '0', 10)
      const db = parseInt(b.analysis_version?.replace('day_', '') || '0', 10)
      return db - da
    })[0]
  const latestDayNoteText = latestDayNote?.user_feedback?.trim() || ''
  const latestDayLabel = latestDayNote?.analysis_version?.startsWith('day_')
    ? `Day ${latestDayNote.analysis_version.replace('day_', '')} Update`
    : 'Current Status'

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
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({patient.patient_identifier})</span>
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

      <div className="px-4 py-3 space-y-3 text-sm">

        {/* ── Ward round note body ── */}
        {wardRoundNote ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Round Note
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
              >
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {wardRoundNote}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-400 dark:text-gray-500 italic">
              No round note yet.{' '}
              {!latestAnalysis && 'Run the admission analysis first, then '}
              {latestAnalysis && 'Click to generate a structured ward round presentation.'}
            </p>
            {latestAnalysis && (
              <>
                {genError && (
                  <p className="text-red-500 text-xs">{genError}</p>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Generating…' : 'Generate Round Note'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Day note: current status update ── */}
        {latestDayNoteText && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1.5">
              {latestDayLabel}
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {latestDayNoteText}
            </p>
          </div>
        )}

        {/* ── AI Assessment ── */}
        {hasAiAssessment && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              AI Assessment
            </p>
            {impression && (
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Impression</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{impression}</p>
              </div>
            )}
            {differentials && (
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Differentials</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{differentials}</p>
              </div>
            )}
            {adjustedPlan && (
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Adjusted Plan</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{adjustedPlan}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
