'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import {
  calculateDayOfAdmission,
  extractChiefComplaintWithDuration,
  extractKnownConditions,
  extractObgynData,
  extractHpiSummary,
  extractRosPositives,
  extractPostAdmissionSymptoms,
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
  const obgyn = extractObgynData(patient.history_text, patient.patient_gender)
  const hpiSummary = extractHpiSummary(patient.history_text)
  const rosPositives = extractRosPositives(patient.history_text)
  const postAdmissionSymptoms = extractPostAdmissionSymptoms(allAnalyses)
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

  // Build the demographic line
  const demoLine: string[] = []
  if (patient.patient_age) demoLine.push(`${patient.patient_age}y`)
  if (patient.patient_gender) demoLine.push(patient.patient_gender.charAt(0).toUpperCase() + patient.patient_gender.slice(1))
  if (obgyn.obstetricFormula) demoLine.push(obgyn.obstetricFormula)
  demoLine.push(`Day ${dayOfAdmission} of Admission`)

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
              {demoLine.join(' | ')}
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
        {/* OB/GYN data for female patients */}
        {(obgyn.lmp || obgyn.edd || obgyn.gestationalAge) && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">OB/GYN: </span>
            <span className="text-gray-700 dark:text-gray-300">
              {[
                obgyn.lmp && `LMP: ${obgyn.lmp}`,
                obgyn.gestationalAge && `Gestation: ${obgyn.gestationalAge}`,
                obgyn.edd && `EDD: ${obgyn.edd}`,
              ].filter(Boolean).join(' | ')}
            </span>
          </div>
        )}

        {/* Known conditions / comorbidities */}
        {knownConditions.length > 0 && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Comorbidities: </span>
            <span className="text-gray-700 dark:text-gray-300">{knownConditions.join(', ')}</span>
          </div>
        )}

        {/* Chief complaint with duration */}
        <div>
          <span className="font-semibold text-gray-800 dark:text-gray-200">Chief Complaint: </span>
          <span className="text-gray-700 dark:text-gray-300">{chiefComplaint}</span>
        </div>

        {/* HPI summary */}
        {hpiSummary && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">HPI: </span>
            <span className="text-gray-700 dark:text-gray-300">{hpiSummary}</span>
          </div>
        )}

        {/* Post-admission symptoms */}
        {postAdmissionSymptoms && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Post-Admission Symptoms: </span>
            <span className="text-gray-700 dark:text-gray-300">{postAdmissionSymptoms}</span>
          </div>
        )}

        {/* ROS positives */}
        {rosPositives.length > 0 && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">ROS (+): </span>
            <span className="text-gray-700 dark:text-gray-300">{rosPositives.join(', ')}</span>
          </div>
        )}

        {/* Impressions */}
        {impressions && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Impression: </span>
            <span className="text-gray-700 dark:text-gray-300">{impressions}</span>
          </div>
        )}

        {/* Test results */}
        {testResults && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Investigations: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{testResults}</p>
          </div>
        )}

        {/* Current management plan */}
        {currentPlan && (
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Current Plan: </span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{currentPlan}</p>
          </div>
        )}

        {/* Expanded: Course since admission + AI Summary */}
        {expanded && (
          <>
            {buildCourseSummary(allAnalyses) && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Course Since Admission: </span>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{buildCourseSummary(allAnalyses)}</p>
              </div>
            )}
            {latestAnalysis?.summary && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="font-semibold text-gray-800 dark:text-gray-200">AI Summary: </span>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">{latestAnalysis.summary}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
