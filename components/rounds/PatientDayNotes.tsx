'use client'

import { useState } from 'react'
import { extractSectionFromAnalysis } from '@/lib/utils/rounds-parser'
import { PrintButton } from './PrintButton'

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayNote {
  analysisVersion: string
  label: string
  note: string
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
    created_at: string
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDayNotes(
  allAnalyses: PatientDayNotesProps['allAnalyses']
): DayNote[] {
  const notes: DayNote[] = []
  for (const a of allAnalyses) {
    if (a.analysis_version === 'admission' && a.user_feedback?.trim()) {
      notes.push({
        analysisVersion: 'admission',
        label: 'Day 1 of Admission',
        note: a.user_feedback.trim(),
        sortKey: 0,
      })
    } else if (a.analysis_version?.startsWith('day_') && a.user_feedback?.trim()) {
      const n = parseInt(a.analysis_version.replace('day_', '') || '0', 10)
      notes.push({
        analysisVersion: a.analysis_version,
        label: `Day ${n} Update`,
        note: a.user_feedback.trim(),
        sortKey: n,
      })
    }
  }
  return notes.sort((a, b) => b.sortKey - a.sortKey)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PatientDayNotes({ patient, latestAnalysis, allAnalyses }: PatientDayNotesProps) {
  const [dayNotes, setDayNotes] = useState<DayNote[]>(() => buildDayNotes(allAnalyses))
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [editingVersion, setEditingVersion] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasAdmissionNote = dayNotes.some(n => n.analysisVersion === 'admission')

  const impression = latestAnalysis ? extractImpression(latestAnalysis.raw_analysis_text) : ''
  const differentials = latestAnalysis ? extractDifferentials(latestAnalysis.raw_analysis_text) : ''
  const adjustedPlan = latestAnalysis ? extractAdjustedPlan(latestAnalysis.raw_analysis_text) : ''
  const hasAiAssessment = !!(impression || differentials || adjustedPlan)

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
      setDayNotes(prev => {
        const without = prev.filter(n => n.analysisVersion !== 'admission')
        return [
          ...without,
          { analysisVersion: 'admission', label: 'Day 1 of Admission', note, sortKey: 0 },
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
    <div className="space-y-4 print:space-y-4">

      {/* ── Day notes in descending order ── */}
      {dayNotes.map(dayNote => (
        <div
          key={dayNote.analysisVersion}
          className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400"
        >
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {dayNote.label}
            </p>
            <div className="flex items-center gap-3">
              {dayNote.analysisVersion === 'admission' && (
                <button
                  onClick={handleGenerate}
                  disabled={generating || editingVersion === 'admission'}
                  className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-40 print:hidden"
                >
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
              )}
              {editingVersion === dayNote.analysisVersion ? (
                <div className="flex items-center gap-2 print:hidden">
                  {saveError && (
                    <span className="text-xs text-red-500">{saveError}</span>
                  )}
                  <button
                    onClick={cancelEdit}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(dayNote.analysisVersion)}
                    disabled={saving}
                    className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(dayNote)}
                  className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-300 print:hidden"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-3">
            {editingVersion === dayNote.analysisVersion ? (
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full min-h-[220px] text-sm font-mono text-gray-800 dark:text-gray-200 bg-transparent border border-indigo-200 dark:border-indigo-700 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {dayNote.note}
              </p>
            )}
          </div>
        </div>
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

      {/* ── AI Assessment ── */}
      {hasAiAssessment && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid print:border-gray-400">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              AI Assessment
            </p>
          </div>
          <div className="px-4 py-3 space-y-3 text-sm">
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
        </div>
      )}
    </div>
  )
}
