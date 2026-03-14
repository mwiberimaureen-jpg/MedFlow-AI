'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { parseAnalysisText, mergeGapsContent } from '@/lib/utils/parse-analysis'

interface TodoItemData {
    id: string
    title: string
    description?: string | null
    priority: string
    category: string
    is_completed: boolean
    order_index: number
}

interface AnalysisData {
    id: string
    raw_analysis_text: string
    todo_items: TodoItemData[]
    summary: string
    risk_level: string
    created_at: string
    total_items: number
    completed_items: number
    model_used?: string
    processing_time_ms?: number
}

interface DayAdmissionCardProps {
    patientId: string
    dayNumber: number
    analysis: AnalysisData
    sectionAnswers: Record<string, string>
    onSectionAnswerChange: (key: string, value: string) => void
    onSubmitDay: (notes: string) => Promise<void>
    submitting: boolean
    dayLabel: string
}

function formatSectionContent(content: string): string {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- \[ \] (.+)$/gm, '<label class="flex items-start gap-2 mb-1"><input type="checkbox" class="mt-1 rounded" disabled /> <span>$1</span></label>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<div class="ml-4 mb-1"><strong>$1.</strong> $2</div>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>')
}

const SECTION_PLACEHOLDERS: Record<string, string> = {
    follow_up_questions: 'Answer the follow-up questions above...',
    review_of_systems: 'GI: no nausea/vomiting. Respiratory: no SOB. CVS: no chest pain...',
    vitals: 'BP 120/80, HR 78, Temp 36.5, RR 18, SpO2 98%...',
    physical_exam: 'General: alert. Abdomen: soft, non-tender. Extremities: no edema...',
    confirmatory_tests: 'Report results of ordered tests or new test results...',
    management_plan: 'Medication changes, new orders, dose adjustments...',
}

// Map analysis section titles to our section keys
function getSectionKey(title: string): string {
    const t = title.toLowerCase()
    if (t.includes('follow-up') || t.includes('gaps')) return 'follow_up_questions'
    if (t.includes('physical exam')) return 'physical_exam'
    if (t.includes('test interpretation')) return 'test_interpretation'
    if (t.includes('confirmatory')) return 'confirmatory_tests'
    if (t.includes('management')) return 'management_plan'
    if (t.includes('complication')) return 'complications'
    if (t.includes('impression')) return 'impressions'
    if (t.includes('differential')) return 'differential_diagnoses'
    if (t.includes('clinical summary')) return 'clinical_summary'
    return t.replace(/\s+/g, '_')
}

// Fuzzy matching for auto-check
function extractMatchKeywords(title: string): string[] {
    const lower = title.toLowerCase()
    const keywords: string[] = []
    const medTerms: Record<string, string[]> = {
        'dvt': ['dvt', 'deep vein thrombosis', 'calf tenderness', 'homan'],
        'pe': ['pulmonary embolism', 'chest pain', 'dyspnea', 'tachycardia'],
        'vital': ['vitals', 'bp', 'blood pressure', 'heart rate', 'temperature', 'pulse', 'spo2'],
        'blood': ['blood', 'cbc', 'hemoglobin', 'hb', 'wbc', 'platelets', 'fbc'],
        'urine': ['urine', 'urinalysis', 'ua', 'urine output'],
        'wound': ['wound', 'incision', 'surgical site', 'dressing'],
        'pain': ['pain', 'analgesia', 'analgesic', 'vas', 'pain score'],
        'antibiotic': ['antibiotic', 'antibiotics', 'antimicrobial', 'amoxicillin', 'ceftriaxone'],
        'fluid': ['fluid', 'iv fluid', 'hydration', 'intake', 'output'],
        'mobility': ['mobility', 'mobilize', 'ambulation', 'walking', 'physiotherapy'],
        'diet': ['diet', 'feeding', 'oral intake', 'npo'],
    }
    const cleaned = lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (cleaned.length > 3) keywords.push(cleaned)
    const words = cleaned.split(' ').filter(w => w.length >= 4)
    keywords.push(...words)
    for (const [key, terms] of Object.entries(medTerms)) {
        if (lower.includes(key)) keywords.push(...terms)
    }
    return [...new Set(keywords)]
}

function doesInputMatchItem(itemTitle: string, allUserInput: string): boolean {
    if (!allUserInput.trim()) return false
    const inputLower = allUserInput.toLowerCase()
    const keywords = extractMatchKeywords(itemTitle)
    for (const kw of keywords) {
        if (kw.length >= 3 && inputLower.includes(kw)) return true
    }
    return false
}

/** Collapsible section inside Assessment */
function DaySection({ title, icon, aiContent, inputKey, placeholder, value, onChange, defaultOpen = false }: {
    title: string
    icon: string
    aiContent?: string
    inputKey?: string
    placeholder?: string
    value?: string
    onChange?: (value: string) => void
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    const hasFilled = !!(value && value.trim())

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="w-full text-left flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>{icon}</span>
                    {title}
                    {hasFilled && <span className="text-green-500 text-xs">✓</span>}
                </h4>
                <span className="text-xs text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {open ? '▾' : '▸'}
                </span>
            </button>
            {open && (
                <div className="px-4 py-3 space-y-3">
                    {aiContent && (
                        <div
                            className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatSectionContent(aiContent) }}
                        />
                    )}
                    {inputKey && onChange && (
                        <div className={aiContent ? 'pt-2 border-t border-dashed border-gray-200 dark:border-gray-600' : ''}>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                Your response
                            </label>
                            <textarea
                                value={value || ''}
                                onChange={e => onChange(e.target.value)}
                                rows={3}
                                placeholder={placeholder}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y bg-white dark:bg-gray-800 dark:text-gray-200"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Labels for the summary display
const SUMMARY_LABELS: Array<{ key: string; label: string }> = [
    { key: 'follow_up_questions', label: 'History of Presenting Illness' },
    { key: 'review_of_systems', label: 'Review of Systems' },
    { key: 'vitals', label: 'Vital Signs' },
    { key: 'physical_exam', label: 'Physical Examination' },
    { key: 'confirmatory_tests', label: 'Investigations' },
    { key: 'management_plan', label: 'Plan' },
]

/** Build a clinical history narrative from section answers */
function buildClinicalNotes(sectionAnswers: Record<string, string>, dayLabel: string): string {
    const parts: string[] = []
    parts.push(`${dayLabel} of Admission\n`)

    for (const { key, label } of SUMMARY_LABELS) {
        const value = sectionAnswers[key]?.trim()
        if (value) {
            parts.push(`${label}:\n${value}`)
        }
    }

    if (parts.length <= 1) return ''
    return parts.join('\n\n')
}

export function DayAdmissionCard({
    patientId,
    dayNumber,
    analysis,
    sectionAnswers,
    onSectionAnswerChange,
    onSubmitDay,
    submitting,
    dayLabel,
}: DayAdmissionCardProps) {
    const [error, setError] = useState<string | null>(null)
    const [assessmentOpen, setAssessmentOpen] = useState(true)
    const [todoItems, setTodoItems] = useState<TodoItemData[]>(analysis.todo_items || [])
    const [completedCount, setCompletedCount] = useState(analysis.completed_items || 0)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const autoCheckedRef = useRef<Set<string>>(new Set())
    const [editedNotes, setEditedNotes] = useState<string | null>(null) // null = auto-generated, string = user edited

    // Parse analysis sections
    const analysisSections = useMemo(() => {
        const parsed = parseAnalysisText(analysis.raw_analysis_text)
        const gapsIdx = parsed.findIndex(s => s.title.toLowerCase().includes('gaps'))
        const followUpIdx = parsed.findIndex(s => /follow.?up\s+questions/i.test(s.title))
        if (gapsIdx !== -1 && followUpIdx !== -1 && gapsIdx !== followUpIdx) {
            const gapsContent = mergeGapsContent(parsed[gapsIdx].content)
            parsed[followUpIdx] = { ...parsed[followUpIdx], content: parsed[followUpIdx].content + '\n' + gapsContent }
            parsed.splice(gapsIdx, 1)
        } else if (gapsIdx !== -1) {
            parsed[gapsIdx] = { ...parsed[gapsIdx], content: mergeGapsContent(parsed[gapsIdx].content) }
        }
        const map: Record<string, string> = {}
        for (const s of parsed) { map[getSectionKey(s.title)] = s.content }
        return map
    }, [analysis.raw_analysis_text])

    // ROS guidance from clinical context
    const rosGuidance = useMemo(() => {
        const summary = analysisSections['clinical_summary'] || ''
        const systems: string[] = []
        const systemChecks = [
            { pattern: /gastrointestinal|gi|nausea|vomit|abdomen|bowel/i, label: 'GI (nausea, vomiting, bowel habits, appetite)' },
            { pattern: /respiratory|breath|cough|dyspnea|lung/i, label: 'Respiratory (SOB, cough, chest tightness)' },
            { pattern: /cardiovascular|cvs|chest pain|palpitation|edema/i, label: 'CVS (chest pain, palpitations, edema)' },
            { pattern: /urinary|urine|micturition|dysuria/i, label: 'GU (dysuria, frequency, urine output)' },
            { pattern: /neurological|headache|dizzy|seizure|weakness/i, label: 'Neuro (headache, dizziness, weakness)' },
            { pattern: /musculoskeletal|joint|pain|back|mobility/i, label: 'MSK (joint pain, mobility, back pain)' },
            { pattern: /skin|rash|wound|incision/i, label: 'Skin (rash, wound status, healing)' },
            { pattern: /obstetric|gyn|vaginal|bleed|contraction|fetal/i, label: 'OB/GYN (vaginal bleeding, contractions, fetal movement)' },
        ]
        for (const { pattern, label } of systemChecks) {
            if (pattern.test(summary) || pattern.test(analysis.raw_analysis_text)) systems.push(label)
        }
        if (systems.length === 0) systems.push('Constitutional (fever, chills, weight changes)')
        return systems
    }, [analysisSections, analysis.raw_analysis_text])

    // Todo toggle
    const handleToggle = useCallback(async (itemId: string, newChecked: boolean) => {
        setTodoItems(prev => prev.map(item => item.id === itemId ? { ...item, is_completed: newChecked } : item))
        setCompletedCount(prev => newChecked ? prev + 1 : prev - 1)
        setTogglingIds(prev => new Set([...prev, itemId]))
        try {
            const res = await fetch(`/api/analyses/${analysis.id}/todos`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ todo_item_id: itemId, is_checked: newChecked })
            })
            if (!res.ok) throw new Error('Failed to update')
        } catch {
            setTodoItems(prev => prev.map(item => item.id === itemId ? { ...item, is_completed: !newChecked } : item))
            setCompletedCount(prev => newChecked ? prev - 1 : prev + 1)
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
        }
    }, [analysis.id])

    // Auto-check from user input
    useEffect(() => {
        const allInput = Object.values(sectionAnswers).join('\n')
        if (!allInput.trim()) return
        const itemsToCheck: string[] = []
        for (const item of todoItems) {
            if (item.is_completed || autoCheckedRef.current.has(item.id)) continue
            if (doesInputMatchItem(item.title, allInput)) itemsToCheck.push(item.id)
        }
        for (const itemId of itemsToCheck) {
            autoCheckedRef.current.add(itemId)
            handleToggle(itemId, true)
        }
    }, [sectionAnswers, todoItems, handleToggle])

    // Submit uses the displayNotes (which the user can edit)
    const handleSubmit = async () => {
        const notes = displayNotes.trim()
        if (notes.length < 10) {
            setError('Please fill in at least one section with enough detail (minimum 10 characters total)')
            return
        }
        setError(null)
        await onSubmitDay(notes)
    }

    const hasContent = Object.values(sectionAnswers).some(v => v?.trim().length > 0)
    const allItemsSorted = useMemo(() => [...todoItems].sort((a, b) => a.order_index - b.order_index), [todoItems])
    const totalItems = todoItems.length

    // Filled sections for the summary area
    const filledSections = SUMMARY_LABELS.filter(({ key }) => sectionAnswers[key]?.trim())

    // Auto-generated clinical notes from assessment inputs
    const autoNotes = useMemo(() => buildClinicalNotes(sectionAnswers, dayLabel), [sectionAnswers, dayLabel])

    // The displayed notes: user-edited version takes priority, otherwise auto-generated
    const displayNotes = editedNotes !== null ? editedNotes : autoNotes

    // When assessment inputs change and user hasn't manually edited, update automatically
    useEffect(() => {
        if (editedNotes === null) return // still in auto mode, no action needed
        // If user has edited but assessment changed, keep their edits
    }, [autoNotes, editedNotes])

    return (
        <Card
            header={{
                title: `${dayLabel} of Admission`,
                subtitle: 'Complete the assessment, check off tasks, then submit'
            }}
        >
            <div className="space-y-5">

                {/* ── 1. ASSESSMENT (collapsible wrapper) ── */}
                <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setAssessmentOpen(prev => !prev)}
                        className="w-full text-left flex items-center justify-between px-5 py-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📋</span>
                            <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">Assessment</h3>
                            {filledSections.length > 0 && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded-full">
                                    {filledSections.length} filled
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                            {assessmentOpen ? '▾ Collapse' : '▸ Expand'}
                        </span>
                    </button>

                    {assessmentOpen && (
                        <div className="p-4 space-y-3">
                            <DaySection
                                title="Follow-up Questions"
                                icon="🔍"
                                aiContent={analysisSections['follow_up_questions']}
                                inputKey="follow_up_questions"
                                placeholder={SECTION_PLACEHOLDERS['follow_up_questions']}
                                value={sectionAnswers['follow_up_questions']}
                                onChange={v => onSectionAnswerChange('follow_up_questions', v)}
                            />
                            <DaySection
                                title="Review of Systems"
                                icon="🔎"
                                aiContent={rosGuidance.length > 0
                                    ? 'Review the following systems:\n' + rosGuidance.map((s, i) => `${i + 1}. ${s}`).join('\n')
                                    : undefined
                                }
                                inputKey="review_of_systems"
                                placeholder={SECTION_PLACEHOLDERS['review_of_systems']}
                                value={sectionAnswers['review_of_systems']}
                                onChange={v => onSectionAnswerChange('review_of_systems', v)}
                            />
                            <DaySection
                                title="Vital Signs"
                                icon="📊"
                                inputKey="vitals"
                                placeholder={SECTION_PLACEHOLDERS['vitals']}
                                value={sectionAnswers['vitals']}
                                onChange={v => onSectionAnswerChange('vitals', v)}
                            />
                            <DaySection
                                title="Physical Examination"
                                icon="🩺"
                                aiContent={analysisSections['physical_exam']}
                                inputKey="physical_exam"
                                placeholder={SECTION_PLACEHOLDERS['physical_exam']}
                                value={sectionAnswers['physical_exam']}
                                onChange={v => onSectionAnswerChange('physical_exam', v)}
                            />
                            <DaySection
                                title="Impression"
                                icon="🎯"
                                aiContent={analysisSections['impressions'] || 'Impression will be generated based on the clinical findings above.'}
                            />
                            <DaySection
                                title="Test Interpretation"
                                icon="🧪"
                                aiContent={analysisSections['test_interpretation'] || 'Interpretation of test results submitted in the initial history and subsequent investigations.'}
                            />
                            <DaySection
                                title="Differential Diagnoses"
                                icon="🔀"
                                aiContent={analysisSections['differential_diagnoses'] || 'Differential diagnoses will be listed here to guide confirmatory testing.'}
                            />
                            <DaySection
                                title="Confirmatory / Follow-up Tests"
                                icon="✅"
                                aiContent={analysisSections['confirmatory_tests'] || 'Tests to rule in or rule out the differential diagnoses above.'}
                                inputKey="confirmatory_tests"
                                placeholder={SECTION_PLACEHOLDERS['confirmatory_tests']}
                                value={sectionAnswers['confirmatory_tests']}
                                onChange={v => onSectionAnswerChange('confirmatory_tests', v)}
                            />
                            <DaySection
                                title="Management Plan"
                                icon="💊"
                                aiContent={analysisSections['management_plan'] || 'Management plan based on current clinical status and investigation results.'}
                                inputKey="management_plan"
                                placeholder={SECTION_PLACEHOLDERS['management_plan']}
                                value={sectionAnswers['management_plan']}
                                onChange={v => onSectionAnswerChange('management_plan', v)}
                            />
                            <DaySection
                                title="Possible Complications & Prevention"
                                icon="⚠️"
                                aiContent={analysisSections['complications'] || 'Potential complications and preventive measures will be outlined here.'}
                            />
                        </div>
                    )}
                </div>

                {/* ── 2. CHECKLIST (brief, below Assessment) ── */}
                {totalItems > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-2">
                                <span>✔️</span>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Checklist</h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {completedCount}/{totalItems}
                                </span>
                            </div>
                            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${(completedCount / totalItems) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="px-5 py-3 space-y-1">
                            {allItemsSorted.map(item => (
                                <label
                                    key={item.id}
                                    className={`flex items-center gap-3 py-1.5 px-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                        item.is_completed ? 'opacity-60' : ''
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={item.is_completed}
                                        disabled={togglingIds.has(item.id)}
                                        onChange={e => handleToggle(item.id, e.target.checked)}
                                        className="h-4 w-4 text-green-600 rounded border-gray-300 dark:border-gray-500 cursor-pointer focus:ring-green-500 disabled:opacity-50"
                                    />
                                    <span className={`text-sm ${
                                        item.is_completed
                                            ? 'line-through text-gray-400 dark:text-gray-500'
                                            : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                        {item.title}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 3. DAY NOTES SUMMARY (editable clinical history) ── */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span>📝</span>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Day Notes Summary</h3>
                        </div>
                        {editedNotes !== null && (
                            <button
                                onClick={() => setEditedNotes(null)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Reset to auto-generated
                            </button>
                        )}
                    </div>
                    <div className="px-5 py-3 space-y-3">
                        {filledSections.length === 0 && editedNotes === null ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                A clinical history will be composed here as you fill in the Assessment sections above. You can edit it before submitting.
                            </p>
                        ) : (
                            <textarea
                                value={displayNotes}
                                onChange={e => setEditedNotes(e.target.value)}
                                rows={Math.max(8, displayNotes.split('\n').length + 2)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y bg-white dark:bg-gray-800 dark:text-gray-200 font-mono"
                                placeholder="Clinical notes will appear here..."
                            />
                        )}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={submitting || (!hasContent && editedNotes === null)}
                            className="max-w-xs"
                        >
                            {submitting ? `Generating ${dayLabel} Analysis...` : `Submit ${dayLabel} Notes`}
                        </Button>
                    </div>
                </div>

            </div>
        </Card>
    )
}
