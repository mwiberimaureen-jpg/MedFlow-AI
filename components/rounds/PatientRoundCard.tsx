'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractChiefComplaint,
  extractKnownConditions,
  extractSectionFromAnalysis
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
  analysisCount: number
}

export function PatientRoundCard({ patient, latestAnalysis, analysisCount }: PatientRoundCardProps) {
  const [expanded, setExpanded] = useState(false)

  const dayOfAdmission = calculateDayOfAdmission(patient.created_at)
  const chiefComplaint = extractChiefComplaint(patient.history_text)
  const knownConditions = extractKnownConditions(patient.history_text)
  const triage = getTriageFromRiskLevel(latestAnalysis?.risk_level)

  const currentPlan = latestAnalysis
    ? extractSectionFromAnalysis(latestAnalysis.raw_analysis_text, 'management_plan')
    : ''
  const impressions = latestAnalysis
    ? extractSectionFromAnalysis(latestAnalysis.raw_analysis_text, 'impressions')
    : ''
  const testResults = latestAnalysis
    ? extractSectionFromAnalysis(latestAnalysis.raw_analysis_text, 'test_interpretation')
    : ''

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {patient.patient_name}
              {patient.patient_identifier && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({patient.patient_identifier})</span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {patient.patient_age && `${patient.patient_age}y`}
              {patient.patient_gender && ` / ${patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1)}`}
              {` | Day ${dayOfAdmission}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {triage && (
            <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline no-print"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Summary body */}
      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Known conditions */}
        {knownConditions.length > 0 && (
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Background: </span>
            <span className="text-gray-600 dark:text-gray-400">{knownConditions.join(' | ')}</span>
          </div>
        )}

        {/* Chief complaint */}
        <div>
          <span className="font-semibold text-gray-700 dark:text-gray-300">Chief Complaint: </span>
          <span className="text-gray-600 dark:text-gray-400">{chiefComplaint}</span>
        </div>

        {/* Impressions */}
        {impressions && (
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Impression: </span>
            <span className="text-gray-600 dark:text-gray-400">{impressions}</span>
          </div>
        )}

        {/* New symptoms / latest progress */}
        {latestAnalysis?.user_feedback && (
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Latest Update: </span>
            <span className="text-gray-600 dark:text-gray-400">{latestAnalysis.user_feedback}</span>
          </div>
        )}

        {/* Expanded details */}
        {(expanded || true) && (
          <div className={`space-y-3 ${expanded ? '' : 'hidden print:block'}`}>
            {/* Test results */}
            {testResults && (
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Relevant Results: </span>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1">{testResults}</p>
              </div>
            )}

            {/* Current management plan */}
            {currentPlan && (
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Current Plan: </span>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1">{currentPlan}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
