'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { DeletePatientButton } from './DeletePatientButton'

interface PatientData {
  id: string
  patient_name: string
  patient_identifier?: string | null
  patient_age?: number | null
  patient_gender?: string | null
  status: string
  metadata?: Record<string, any> | null
  created_at: string
  analyses: Array<{ risk_level: string; analysis_version: string | null; created_at: string }> | null
}

interface PatientsListProps {
  patients: PatientData[]
}

export function PatientsList({ patients: initialPatients }: PatientsListProps) {
  const [patients, setPatients] = useState(initialPatients)
  const [rotationFilter, setRotationFilter] = useState<string>('__all__')

  const getRotation = (p: PatientData) => p.metadata?.rotation || null

  // Collect unique rotations
  const userRotations = useMemo(() => {
    const set = new Set<string>()
    patients.forEach(p => {
      const r = getRotation(p)
      if (r) set.add(r)
    })
    return [...set].sort()
  }, [patients])

  // Counts per rotation
  const rotationCounts = useMemo(() => {
    const counts: Record<string, number> = { '__all__': patients.length, '__uncategorized__': 0 }
    patients.forEach(p => {
      const r = getRotation(p)
      if (!r) {
        counts['__uncategorized__']++
      } else {
        counts[r] = (counts[r] || 0) + 1
      }
    })
    return counts
  }, [patients])

  const filteredPatients = patients.filter(p => {
    const r = getRotation(p)
    if (rotationFilter === '__all__') return true
    if (rotationFilter === '__uncategorized__') return !r
    return r === rotationFilter
  })

  const handleRotationChange = async (patientId: string, rotation: string | null) => {
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation }),
      })
      if (!res.ok) throw new Error('Failed to move patient')
      const data = await res.json()
      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, metadata: data.patient.metadata } : p))
    } catch (err: any) {
      alert('Failed to move patient: ' + err.message)
    }
  }

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

  const allRotations = [...new Set([...DEFAULT_ROTATIONS, ...userRotations])].sort()

  return (
    <>
      {/* Rotation filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={rotationFilter}
          onChange={e => setRotationFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="__all__">All Rotations ({rotationCounts['__all__']})</option>
          {userRotations.map(r => (
            <option key={r} value={r}>{r} ({rotationCounts[r] || 0})</option>
          ))}
          {rotationCounts['__uncategorized__'] > 0 && (
            <option value="__uncategorized__">Uncategorized ({rotationCounts['__uncategorized__']})</option>
          )}
        </select>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No patients in this rotation</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {rotationFilter !== '__all__' ? 'Try selecting a different rotation or add a new patient.' : 'Get started by adding your first patient history.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: compact clickable list */}
          <div className="md:hidden space-y-2">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3"
              >
                <Link
                  href={`/dashboard/patients/${patient.id}`}
                  className="flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {patient.patient_identifier || patient.patient_name}
                      </p>
                      {getRotation(patient) && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {getRotation(patient)}
                        </span>
                      )}
                    </div>
                    {patient.patient_identifier && patient.patient_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{patient.patient_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {renderTriageBadge(patient)}
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                <div className="flex items-center gap-1 mt-1">
                  <MoveToRotationMenu
                    currentRotation={getRotation(patient)}
                    allRotations={allRotations}
                    onMove={(r) => handleRotationChange(patient.id, r)}
                  />
                  <DeletePatientButton patientId={patient.id} patientName={patient.patient_name} variant="icon" />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rotation
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
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{patient.patient_name}</div>
                      {patient.patient_identifier && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{patient.patient_identifier}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <MoveToRotationMenu
                        currentRotation={getRotation(patient)}
                        allRotations={allRotations}
                        onMove={(r) => handleRotationChange(patient.id, r)}
                      />
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
    </>
  )
}

// Small inline component for the folder/move menu
function MoveToRotationMenu({
  currentRotation,
  allRotations,
  onMove,
}: {
  currentRotation: string | null
  allRotations: string[]
  onMove: (rotation: string | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
        title="Change rotation"
      >
        {currentRotation ? (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            {currentRotation}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-xs italic">No rotation</span>
        )}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 max-h-60 overflow-y-auto">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(null); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 ${
                !currentRotation ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              No rotation
            </button>
            {allRotations.map(r => (
              <button
                key={r}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(r); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 ${
                  currentRotation === r ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
