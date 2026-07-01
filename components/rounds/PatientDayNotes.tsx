'use client'

import { useState } from 'react'
import { extractSectionFromAnalysis, extractChiefComplaintWithDuration } from '@/lib/utils/rounds-parser'
import { PrintButton } from './PrintButton'

// ── AI plan extraction ────────────────────────────────────────────────────────

function extractAiPlan(rawText: string): string {
  if (!rawText) return ''
  const parts: string[] = []

  // Impression
  const impMatch = rawText.match(/##\s*Impression\(s\)\s*\n([\s\S]*?)(?=\n##\s|$)/i)
  if (impMatch?.[1]) {
    const imp = impMatch[1].trim().replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-•]\s*/gm, '').trim()
    if (imp) parts.push(`Impression:\n${imp}`)
  }

  // Recommended management plan
  const mgmtMatch = rawText.match(/##\s*Management Plan\s*\n([\s\S]*?)(?=\n##\s|$)/i)
  if (mgmtMatch?.[1]) {
    const text = mgmtMatch[1].trim()
    const recMatch = text.match(/\*\*Recommended Plan:\*\*\s*([\s\S]*?)(?:\*\*Adjustments|$)/i)
    const adjMatch = text.match(/\*\*Adjustments Based on Patient Status:\*\*\s*([\s\S]*?)$/i)

    if (recMatch?.[1]?.trim()) {
      const steps = recMatch[1].trim()
        .split('\n').map((l: string) => l.trim()).filter(Boolean)
        .map((l: string) => l.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim())
        .filter(Boolean)
        .map((l: string, i: number) => `${i + 1}. ${l}`)
      if (steps.length) parts.push(`Recommended Plan:\n${steps.join('\n')}`)
    }

    if (adjMatch?.[1]?.trim()) {
      const adj = adjMatch[1].trim().replace(/\*\*(.*?)\*\*/g, '$1')
      if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) {
        parts.push(`Adjustments: ${adj}`)
      }
    }
  }

  // Follow-up / confirmatory tests
  const testSection = extractSectionFromAnalysis(rawText, 'confirmatory_tests')
  if (testSection) parts.push(`Follow-up tests:\n${testSection}`)

  return parts.join('\n\n')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayNote {
  analysisVersion: string
  label: string
  note: string
  aiPlan: string
  sortKey: number
}

interface PatientDayNotesProps {
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
    raw_analysis_text?: string | null
    created_at: string
  }>
}

// ── Build day notes ───────────────────────────────────────────────────────────

function buildDemographicsLine(patient: PatientDayNotesProps['patient']): string {
  const parts: string[] = [patient.patient_name]
  if (patient.patient_age) parts.push(`${patient.patient_age} yrs`)
  if (patient.patient_gender) parts.push(patient.patient_gender)
  return parts.join(', ') + '.'
}

function buildDayNotes(
  allAnalyses: PatientDayNotesProps['allAnalyses'],
  patient: PatientDayNotesProps['patient']
): DayNote[] {
  const notes: DayNote[] = []

  const demographicsLine = buildDemographicsLine(patient)
  const cc = extractChiefComplaintWithDuration(patient.history_text)

  for (const a of allAnalyses) {
    if (a.analysis_version === 'admission' && a.user_feedback?.trim()) {
      notes.push({
        analysisVersion: 'admission',
        label: 'Day 1 of Admission',
        note: a.user_feedback.trim(),
        aiPlan: extractAiPlan(a.raw_analysis_text || ''),
        sortKey: 0,
      })
    } else if (a.analysis_version?.startsWith('day_') && a.user_feedback?.trim()) {
      const n = parseInt(a.analysis_version.replace('day_', '') || '0', 10)
      // Build a rounds-ready presentation note: demographics + CC header, then the user's progress notes
      const admittedLine = cc ? `Admitted for: ${cc}` : ''
      const header = [demographicsLine, `Day ${n} of admission.`, admittedLine].filter(Boolean).join('\n')
      const note = `${header}\n\n${a.user_feedback.trim()}`
      notes.push({
        analysisVersion: a.analysis_version,
        label: `Day ${n} Update`,
        note,
        aiPlan: extractAiPlan(a.raw_analysis_text || ''),
        sortKey: n,
      })
    }
  }

  // Newest day first (most recent update at top of rounds view)
  return notes.sort((a, b) => b.sortKey - a.sortKey)
}

// ── Collapsible day card ──────────────────────────────────────────────────────

function DayCard({
  dayNote,
  defaultOpen,
  onEdit,
  onRegenerate,
  generating,
  editingVersion,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  saving,
  saveError,
}: {
  dayNote: DayNote
  defaultOpen: boolean
  onEdit: (d: DayNote) => void
  onRegenerate?: () => void
  generating?: boolean
  editingVersion: string | null
  editText: string
  onEditTextChange: (v: string) => void
  onSaveEdit: (v: string) => void
  onCancelEdit: () => void
  saving: boolean
  saveError: string | null
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isEditing = editingVersion === dayNote.analysisVersion

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">

      {/* Header — click to collapse/expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {dayNote.label}
        </p>
        <div className="flex items-center gap-3 print:hidden">
          {dayNote.analysisVersion === 'admission' && onRegenerate && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); if (!generating && !isEditing) onRegenerate() }}
              className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-40"
            >
              {generating ? 'Regenerating…' : 'Regenerate'}
            </span>
          )}
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {saveError && <span className="text-xs text-red-500">{saveError}</span>}
              <span
                role="button"
                onClick={onCancelEdit}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >Cancel</span>
              <span
                role="button"
                onClick={() => onSaveEdit(dayNote.analysisVersion)}
                className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer"
              >{saving ? 'Saving…' : 'Save'}</span>
            </div>
          ) : (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onEdit(dayNote) }}
              className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer"
            >Edit</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{open ? '▾' : '▸'}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">

          {/* Clinical notes */}
          <div className="px-4 py-3">
            {isEditing ? (
              <textarea
                value={editText}
                onChange={e => onEditTextChange(e.target.value)}
                className="w-full min-h-[220px] text-sm font-mono text-gray-800 dark:text-gray-200 bg-transparent border border-indigo-200 dark:border-indigo-700 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {dayNote.note}
              </p>
            )}
          </div>

          {/* AI recommended plan for this day */}
          {dayNote.aiPlan && !isEditing && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
                AI Recommended Plan
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {dayNote.aiPlan}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PatientDayNotes({ patient, latestAnalysis, allAnalyses }: PatientDayNotesProps) {
  const [dayNotes, setDayNotes] = useState<DayNote[]>(() => buildDayNotes(allAnalyses, patient))
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [editingVersion, setEditingVersion] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasAdmissionNote = dayNotes.some(n => n.analysisVersion === 'admission')

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
      // Use admission analysis for AI plan
      const admissionAnalysis = allAnalyses.find(a => a.analysis_version === 'admission')
      setDayNotes(prev => {
        const without = prev.filter(n => n.analysisVersion !== 'admission')
        return [
          ...without,
          {
            analysisVersion: 'admission',
            label: 'Day 1 of Admission',
            note,
            aiPlan: extractAiPlan(admissionAnalysis?.raw_analysis_text || latestAnalysis?.raw_analysis_text || ''),
            sortKey: 0,
          },
        ].sort((a, b) => b.sortKey - a.sortKey)
      })
    } catch (err: any) {
      setGenError(err?.message || 'Failed to generate note')
    } finally {
      setGenerating(false)
    }
  }

  function startEdit(dayNote: DayNote) {
    setEditingVersion(dayNote.analysisVersion)
    setEditText(dayNote.note)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingVersion(null)
    setEditText('')
    setSaveError(null)
  }

  async function saveEdit(analysisVersion: string) {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/patients/${patient.id}/round-note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_version: analysisVersion, note: editText }),
      })
      if (!res.ok) throw new Error('Save failed')
      setDayNotes(prev =>
        prev.map(n => n.analysisVersion === analysisVersion ? { ...n, note: editText } : n)
      )
      setEditingVersion(null)
      setEditText('')
    } catch {
      setSaveError('Could not save — your changes are still here.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 print:space-y-4">

      {/* ── Day notes — newest first, all collapsible ── */}
      {dayNotes.map((dayNote, idx) => (
        <DayCard
          key={dayNote.analysisVersion}
          dayNote={dayNote}
          defaultOpen={idx === 0}
          onEdit={startEdit}
          onRegenerate={dayNote.analysisVersion === 'admission' ? handleGenerate : undefined}
          generating={generating}
          editingVersion={editingVersion}
          editText={editText}
          onEditTextChange={setEditText}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          saving={saving}
          saveError={saveError}
        />
      ))}

      {/* ── Generate Day 1 note if not yet generated ── */}
      {!hasAdmissionNote && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Day 1 of Admission
            </p>
          </div>
          <div className="px-4 py-4 space-y-2">
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              {latestAnalysis
                ? 'No round note yet. Generate one from the admission history.'
                : 'Run the admission analysis first, then generate a round note.'}
            </p>
            {genError && <p className="text-red-500 text-xs">{genError}</p>}
            {latestAnalysis && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                {generating ? 'Generating…' : 'Generate Round Note'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
