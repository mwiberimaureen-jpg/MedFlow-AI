'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { calculateDayOfAdmission, extractObgynData } from '@/lib/utils/rounds-parser'

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

function extractPlan(rawText: string): string {
  if (!rawText) return ''

  const mgmtMatch = rawText.match(/## Management Plan\s*([\s\S]*?)(?=\n## |$)/i)
  if (!mgmtMatch) return ''

  const content = mgmtMatch[1]
  const parts: string[] = []

  const recMatch = content.match(/\*\*Recommended Plan:\*\*\s*([\s\S]*?)(?:\*\*Adjustments|$)/i)
  if (recMatch?.[1]?.trim()) {
    const steps = recMatch[1].trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim()}`)
    if (steps.length) parts.push(`Recommended Plan:\n${steps.join('\n')}`)
  }

  const adjMatch = content.match(/\*\*Adjustments Based on Patient Status:\*\*\s*([\s\S]*?)$/i)
  if (adjMatch?.[1]?.trim()) {
    const adj = adjMatch[1].trim().replace(/\*\*(.*?)\*\*/g, '$1')
    if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) {
      parts.push(`Adjustments Based on Patient Status: ${adj}`)
    }
  }

  return parts.join('\n\n')
}

export function PatientRoundCard({ patient, latestAnalysis, allAnalyses, analysisCount }: PatientRoundCardProps) {
  const [expanded, setExpanded] = useState(false)

  const dayOfAdmission = calculateDayOfAdmission(patient.created_at)
  const obgyn = extractObgynData(patient.history_text, patient.patient_gender)
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  const demoLine: string[] = []
  if (patient.patient_age) demoLine.push(`${patient.patient_age}y`)
  if (patient.patient_gender) demoLine.push(patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1))
  if (obgyn.obstetricFormula) demoLine.push(obgyn.obstetricFormula)
  demoLine.push(`Day ${dayOfAdmission} of Admission`)

  const summary = latestAnalysis?.summary || ''
  const plan = latestAnalysis ? extractPlan(latestAnalysis.raw_analysis_text) : ''

  // Latest round notes (user_feedback from most recent non-admission analysis)
  const latestRoundNotes = allAnalyses
    .filter(a => a.analysis_version !== 'admission' && a.user_feedback)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.user_feedback || ''

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">
      {/* Header — always visible */}
      <div
        className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {patient.patient_name}
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
          <span className="text-xs text-blue-600 dark:text-blue-400 no-print">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Summary — short factual handover */}
      <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {summary ? (
          <p className="leading-relaxed">{summary}</p>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">No analysis available yet.</p>
        )}
      </div>

      {/* Expandable: Plan + round notes */}
      {expanded && (plan || latestRoundNotes) && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          {plan && (
            <div className="text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">PLAN</p>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{plan}</p>
            </div>
          )}
          {latestRoundNotes && (
            <div className="text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Round Notes</p>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{latestRoundNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
