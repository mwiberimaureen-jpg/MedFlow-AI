'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { DeletePatientButton } from './DeletePatientButton'
import { StarPatientButton } from './StarPatientButton'

interface PatientData {
  id: string
  patient_name: string
  patient_identifier?: string | null
  patient_age?: number | null
  patient_gender?: string | null
  status: string
  metadata?: Record<string, any> | null
  created_at: string
  is_starred?: boolean | null
  analyses: Array<{ risk_level: string; analysis_version: string | null; created_at: string }> | null
}

interface PatientsListProps {
  patients: PatientData[]
}

export function PatientsList({ patients: initialPatients }: PatientsListProps) {
  const [patients, setPatients] = useState(initialPatients)
  const [openFolder, setOpenFolder] = useState<string | null>(null)

  const getRotation = (p: PatientData) => p.metadata?.rotation || null

  // Group patients by rotation
  const folders = useMemo(() => {
    const groups: Record<string, PatientData[]> = {}
    patients.forEach(p => {
      const r = getRotation(p) || 'Uncategorized'
      if (!groups[r]) groups[r] = []
      groups[r].push(p)
    })
    // Sort folder names, but keep Uncategorized last
    const names = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    return names.map(name => ({ name, patients: groups[name] }))
  }, [patients])

  const getLatestRiskLevel = (analyses: PatientData['analyses']) => {
    if (!analyses || analyses.length === 0) return null
    const clinical = analyses.filter(a => a.analysis_version !== 'discharge')
    if (clinical.length === 0) return null
    const sorted = [...clinical].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted[0].risk_level
  }

  const renderTriageBadge = (patient: PatientData) => {
    const riskLevel = getLatestRiskLevel(patient.analyses)
    const triage = getTriageFromRiskLevel(riskLevel)

    if (triage) {
      return <Badge variant={getTriageBadgeVariant(triage)}>{getTriageLabel(triage)}</Badge>
    }
    if (patient.status === 'analyzing') return <Badge variant="warning">Analyzing</Badge>
    if (patient.status === 'draft') return <Badge variant="info">Draft</Badge>
    if (patient.status === 'error') return <Badge variant="danger">Error</Badge>
    return <Badge variant="default">Unassessed</Badge>
  }

  // Folder view — show folder cards
  if (openFolder === null) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {folders.map(folder => (
          <button
            key={folder.name}
            onClick={() => setOpenFolder(folder.name)}
            className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
          >
            <svg className="w-12 h-12 text-yellow-500 group-hover:text-yellow-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{folder.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {folder.patients.length} {folder.patients.length === 1 ? 'patient' : 'patients'}
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Inside a folder — show patients with back button
  const currentFolder = folders.find(f => f.name === openFolder)
  const folderPatients = currentFolder?.patients || []

  return (
    <div className="space-y-4">
      {/* Breadcrumb / back button */}
      <button
        onClick={() => setOpenFolder(null)}
        className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Folders
      </button>

      <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{openFolder}</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({folderPatients.length} {folderPatients.length === 1 ? 'patient' : 'patients'})
        </span>
      </div>

      {folderPatients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No patients in this folder.</p>
        </div>
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {folderPatients.map((patient) => (
              <Link
                key={patient.id}
                href={`/dashboard/patients/${patient.id}`}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {patient.patient_identifier || patient.patient_name}
                  </p>
                  {patient.patient_identifier && patient.patient_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{patient.patient_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {renderTriageBadge(patient)}
                  <StarPatientButton patientId={patient.id} initialStarred={!!patient.is_starred} />
                  <DeletePatientButton patientId={patient.id} patientName={patient.patient_name} variant="icon" />
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Triage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {folderPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{patient.patient_name}</div>
                      {patient.patient_identifier && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{patient.patient_identifier}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {patient.patient_age || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {patient.patient_gender || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderTriageBadge(patient)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(patient.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/dashboard/patients/${patient.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Details
                        </Link>
                        <StarPatientButton patientId={patient.id} initialStarred={!!patient.is_starred} />
                        <DeletePatientButton patientId={patient.id} patientName={patient.patient_name} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
