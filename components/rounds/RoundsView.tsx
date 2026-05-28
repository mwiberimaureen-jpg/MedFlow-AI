'use client'

import { useState } from 'react'
import { PatientRoundCard } from './PatientRoundCard'
import { PrintButton } from './PrintButton'

interface Patient {
  id: string
  patient_name: string
  patient_age?: number
  patient_gender?: string
  patient_identifier?: string
  history_text: string
  created_at: string
}

interface PatientEntry {
  patient: Patient
  rotation: string | null
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

interface RoundsViewProps {
  patients: PatientEntry[]
}

const FOLDER_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700', icon: 'text-blue-500 dark:text-blue-400', text: 'text-blue-800 dark:text-blue-200', count: 'text-blue-500 dark:text-blue-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700', icon: 'text-violet-500 dark:text-violet-400', text: 'text-violet-800 dark:text-violet-200', count: 'text-violet-500 dark:text-violet-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', icon: 'text-emerald-500 dark:text-emerald-400', text: 'text-emerald-800 dark:text-emerald-200', count: 'text-emerald-500 dark:text-emerald-400' },
  { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', icon: 'text-amber-500 dark:text-amber-400', text: 'text-amber-800 dark:text-amber-200', count: 'text-amber-500 dark:text-amber-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700', icon: 'text-rose-500 dark:text-rose-400', text: 'text-rose-800 dark:text-rose-200', count: 'text-rose-500 dark:text-rose-400' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-700', icon: 'text-teal-500 dark:text-teal-400', text: 'text-teal-800 dark:text-teal-200', count: 'text-teal-500 dark:text-teal-400' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', icon: 'text-orange-500 dark:text-orange-400', text: 'text-orange-800 dark:text-orange-200', count: 'text-orange-500 dark:text-orange-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700', icon: 'text-sky-500 dark:text-sky-400', text: 'text-sky-800 dark:text-sky-200', count: 'text-sky-500 dark:text-sky-400' },
]

export function RoundsView({ patients }: RoundsViewProps) {
  const [openRotation, setOpenRotation] = useState<string | null>(null)

  // Group patients by rotation
  const groups = patients.reduce<Record<string, PatientEntry[]>>((acc, entry) => {
    const key = entry.rotation || '__unassigned__'
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {})

  const rotations = Object.keys(groups)
    .filter(k => k !== '__unassigned__')
    .sort()

  if (groups['__unassigned__']?.length) rotations.push('__unassigned__')

  const openLabel = openRotation === '__unassigned__' ? 'Unassigned' : openRotation

  // ── FOLDER GRID ───────────────────────────────────────────────────────────
  if (openRotation === null) {
    if (rotations.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🏥</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Active Patients</h3>
          <p className="text-gray-600 dark:text-gray-400">All patients have been discharged or are still in draft status.</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {rotations.map((rotation, i) => {
          const color = FOLDER_COLORS[i % FOLDER_COLORS.length]
          const label = rotation === '__unassigned__' ? 'Unassigned' : rotation
          const count = groups[rotation].length
          return (
            <button
              key={rotation}
              onClick={() => setOpenRotation(rotation)}
              className={`${color.bg} ${color.border} border-2 rounded-xl p-5 text-left hover:shadow-md hover:scale-[1.02] transition-all group`}
            >
              <div className="flex items-start justify-between mb-3">
                <svg className={`w-9 h-9 ${color.icon}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                </svg>
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className={`text-sm font-bold ${color.text} leading-snug`}>{label}</p>
              <p className={`text-xs mt-1 ${color.count}`}>{count} {count === 1 ? 'patient' : 'patients'}</p>
            </button>
          )
        })}
      </div>
    )
  }

  // ── INSIDE A ROTATION ─────────────────────────────────────────────────────
  const rotationPatients = groups[openRotation] || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenRotation(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Rotations
          </button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{openLabel}</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">({rotationPatients.length} {rotationPatients.length === 1 ? 'patient' : 'patients'})</span>
        </div>
        <PrintButton />
      </div>

      {/* Patient cards */}
      <div className="space-y-4">
        {rotationPatients.map(({ patient, latestAnalysis, allAnalyses, analysisCount, rotation }) => (
          <PatientRoundCard
            key={patient.id}
            patient={patient}
            latestAnalysis={latestAnalysis}
            allAnalyses={allAnalyses}
            analysisCount={analysisCount}
            rotation={rotation}
          />
        ))}
      </div>
    </div>
  )
}
