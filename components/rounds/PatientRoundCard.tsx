'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractChiefComplaintWithDuration,
  extractKnownConditions,
  extractSectionFromAnalysis,
  buildCourseSummary
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

export function PatientRoundCard({ patient, latestAnalysis, allAnalyses, analysisCount }: PatientRoundCardProps) {
  const [expanded, setExpanded] = useState(false)

  const dayOfAdmission = calculateDayOfAdmission(patient.created_at)
  const chiefComplaint = extractChiefComplaintWithDuration(patient.history_text)
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

  const courseSummary = buildCourseSummary(allAnalyses)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">
      {/* Header */}
      <div
        className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
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
              {` | Day ${dayOfAdmission} of Admission`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {triage ? (
            <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
          ) : (
            <Badge variant="default">Unassessed</Badge>
          )}
          <span className="text-sm text-blue-600 dark:text-blue-400 no-print">
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {/* Summary body — always visible */}
      <div className="px-4 py-3 space-y-2 text-sm">
        {/* Known conditions / background */}
        {knownConditions.length > 0 && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Background: </span>
            <span className="text-gray-700 dark:text-gray-300">{knownConditions.join(' | ')}</span>
          </div>
        )}

        {/* Chief complaint with duration */}
        <div>
          <span className="font-semibold text-gray-800 dark:text-gray-200">Chief Complaint: </span>
          <span className="text-gray-700 dark:text-gray-300">{chiefComplaint}</span>
        </div>

        {/* Impressions */}
        {impressions && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Impression: </span>
            <span className="text-gray-700 dark:text-gray-300">{impressions}</span>
          </div>
        )}

        {/* Course since admission — what has been done */}
        {courseSummary && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Course Since Admission: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1 ml-0">{courseSummary}</p>
          </div>
        )}

        {/* New symptoms / latest progress */}
        {latestAnalysis?.user_feedback && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">New Symptoms / Latest Update: </span>
            <span className="text-gray-700 dark:text-gray-300">{latestAnalysis.user_feedback}</span>
          </div>
        )}

        {/* Relevant test results — always visible */}
        {testResults && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Relevant Results: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{testResults}</p>
          </div>
        )}

        {/* Current management plan — always visible */}
        {currentPlan && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Current Plan: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{currentPlan}</p>
          </div>
        )}

        {/* Expanded: AI Summary */}
        {expanded && latestAnalysis?.summary && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-800 dark:text-gray-200">AI Summary: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{latestAnalysis.summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}
