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
    fallbackComplications?: string
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
    follow_up_questions: 'Write the clinical narrative: Dx, current status, new symptoms, changes since last day...',
    review_of_systems: 'GI: no nausea/vomiting. Resp: no SOB. CVS: no chest pain. GU: no dysuria. Neuro: no headache...',
    vitals: 'BP 120/80, PR 78, Temp 36.5, RR 18, SpO2 98%...',
    physical_exam: 'Abdomen: soft, non-tender. Conjunctivae: pink. Lower limbs: no edema, no tenderness...',
    confirmatory_tests: 'Full Hemogram: HB 12.5, WBC 6.0. CRP: 15. Ultrasound findings...',
    management_plan: '- continue ceftriaxone 1g IV BD.\n- IV PCM 1g TDS.\n- vital signs monitoring 2 hrly.',
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

/** Collapsible section inside Assessment with per-section Submit/Edit */
function DaySection({ title, icon, aiContent, inputKey, placeholder, value, onChange, isSubmitted, onSubmitSection, onEditSection, defaultOpen = false }: {
    title: string
    icon: string
    aiContent?: string
    inputKey?: string
    placeholder?: string
    value?: string
    onChange?: (value: string) => void
    isSubmitted?: boolean
    onSubmitSection?: () => void
    onEditSection?: () => void
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    const hasFilled = !!(value && value.trim())
    const hasInput = !!inputKey

    return (
        <div className={`border rounded-lg overflow-hidden ${
            isSubmitted
                ? 'border-green-200 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-700'
        }`}>
            <button
                onClick={() => setOpen(prev => !prev)}
                className={`w-full text-left flex items-center justify-between gap-2 px-4 py-2 transition-colors ${
                    isSubmitted
                        ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>{icon}</span>
                    {title}
                    {isSubmitted && <span className="text-green-600 dark:text-green-400 text-xs font-bold">Submitted</span>}
                    {!isSubmitted && hasFilled && <span className="text-yellow-500 text-xs">Draft</span>}
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
                    {hasInput && onChange && (
                        <div className={aiContent ? 'pt-2 border-t border-dashed border-gray-200 dark:border-gray-600' : ''}>
                            {isSubmitted ? (
                                <>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
                                        {value}
                                    </p>
                                    <button
                                        onClick={onEditSection}
                                        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Edit
                                    </button>
                                </>
                            ) : (
                                <>
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
                                    {hasFilled && onSubmitSection && (
                                        <button
                                            onClick={onSubmitSection}
                                            className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                        >
                                            Submit
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Sections included in the summary narrative
const SUMMARY_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'follow_up_questions', label: 'History of Presenting Illness' },
    { key: 'review_of_systems', label: 'Review of Systems' },
    { key: 'vitals', label: 'Vital Signs' },
    { key: 'physical_exam', label: 'Physical Examination' },
    { key: 'confirmatory_tests', label: 'Investigations' },
    { key: 'management_plan', label: 'Plan' },
]

/**
 * Build a clinical history narrative from submitted section answers.
 * Matches the clinical documentation format:
 *   - HPI flows as narrative (no header)
 *   - Each subsequent section has its own header on a separate line
 *   - PLAN: in caps with content below
 */
function buildClinicalNotes(sectionAnswers: Record<string, string>, dayLabel: string, submittedSections: Set<string>): string {
    const get = (key: string) => submittedSections.has(key) ? sectionAnswers[key]?.trim() || '' : ''

    const hpi = get('follow_up_questions')
    const ros = get('review_of_systems')
    const vitals = get('vitals')
    const exam = get('physical_exam')
    const investigations = get('confirmatory_tests')
    const plan = get('management_plan')

    const hasContent = [hpi, ros, vitals, exam, investigations, plan].some(v => v)
    if (!hasContent) return ''

    const blocks: string[] = []

    // HPI — the clinical narrative (Dx, status, new symptoms)
    if (hpi) {
        blocks.push(hpi)
    }

    // ROS — brief system-by-system
    if (ros) {
        blocks.push(`Review of Systems:\n${ros}`)
    }

    // Vitals — listed directly, no prefix
    if (vitals) {
        blocks.push(`Vital Signs:\n${vitals}`)
    }

    // Physical Examination — findings directly
    if (exam) {
        blocks.push(`Physical Examination:\n${exam}`)
    }

    // Investigations — test results
    if (investigations) {
        blocks.push(`Investigations:\n${investigations}`)
    }

    // PLAN — management steps
    if (plan) {
        // Ensure plan items start with dashes if they don't already
        const planLines = plan.split('\n').map(line => {
            const trimmed = line.trim()
            if (!trimmed) return ''
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) return trimmed
            return `- ${trimmed}`
        }).filter(Boolean).join('\n')
        blocks.push(`PLAN: \n${planLines}`)
    }

    return blocks.join('\n\n').trim()
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
    fallbackComplications,
}: DayAdmissionCardProps) {
    const [error, setError] = useState<string | null>(null)
    const [assessmentOpen, setAssessmentOpen] = useState(true)
    const [checklistOpen, setChecklistOpen] = useState(true)
    const [notesOpen, setNotesOpen] = useState(true)
    const [todoItems, setTodoItems] = useState<TodoItemData[]>(analysis.todo_items || [])
    const [completedCount, setCompletedCount] = useState(analysis.completed_items || 0)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const autoCheckedRef = useRef<Set<string>>(new Set())
    const [editedNotes, setEditedNotes] = useState<string | null>(null) // null = auto-generated, string = user edited

    // Persist submitted sections in localStorage
    const submittedKey = `submitted-sections-${patientId}`
    const [submittedSections, setSubmittedSections] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set()
        try {
            const saved = localStorage.getItem(submittedKey)
            return saved ? new Set(JSON.parse(saved)) : new Set()
        } catch { return new Set() }
    })

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

    const handleSectionSubmit = useCallback((key: string) => {
        setSubmittedSections(prev => {
            const n = new Set([...prev, key])
            try { localStorage.setItem(submittedKey, JSON.stringify([...n])) } catch {}
            return n
        })
        setEditedNotes(null) // refresh auto-generated notes
    }, [submittedKey])

    const handleSectionEdit = useCallback((key: string) => {
        setSubmittedSections(prev => {
            const n = new Set(prev); n.delete(key)
            try { localStorage.setItem(submittedKey, JSON.stringify([...n])) } catch {}
            return n
        })
    }, [submittedKey])

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
    const filledSections = SUMMARY_SECTIONS.filter(({ key }) => sectionAnswers[key]?.trim())

    // Auto-generated clinical notes from assessment inputs
    const autoNotes = useMemo(() => buildClinicalNotes(sectionAnswers, dayLabel, submittedSections), [sectionAnswers, dayLabel, submittedSections])

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
                            {submittedSections.size > 0 && (
                                <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded-full">
                                    {submittedSections.size} submitted
                                </span>
                            )}
                            {filledSections.length > submittedSections.size && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-800 px-2 py-0.5 rounded-full">
                                    {filledSections.length - submittedSections.size} draft
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
                                isSubmitted={submittedSections.has('follow_up_questions')}
                                onSubmitSection={() => handleSectionSubmit('follow_up_questions')}
                                onEditSection={() => handleSectionEdit('follow_up_questions')}
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
                                isSubmitted={submittedSections.has('review_of_systems')}
                                onSubmitSection={() => handleSectionSubmit('review_of_systems')}
                                onEditSection={() => handleSectionEdit('review_of_systems')}
                            />
                            <DaySection
                                title="Vital Signs"
                                icon="📊"
                                inputKey="vitals"
                                placeholder={SECTION_PLACEHOLDERS['vitals']}
                                value={sectionAnswers['vitals']}
                                onChange={v => onSectionAnswerChange('vitals', v)}
                                isSubmitted={submittedSections.has('vitals')}
                                onSubmitSection={() => handleSectionSubmit('vitals')}
                                onEditSection={() => handleSectionEdit('vitals')}
                            />
                            <DaySection
                                title="Physical Examination"
                                icon="🩺"
                                aiContent={analysisSections['physical_exam']}
                                inputKey="physical_exam"
                                placeholder={SECTION_PLACEHOLDERS['physical_exam']}
                                value={sectionAnswers['physical_exam']}
                                onChange={v => onSectionAnswerChange('physical_exam', v)}
                                isSubmitted={submittedSections.has('physical_exam')}
                                onSubmitSection={() => handleSectionSubmit('physical_exam')}
                                onEditSection={() => handleSectionEdit('physical_exam')}
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
                                isSubmitted={submittedSections.has('confirmatory_tests')}
                                onSubmitSection={() => handleSectionSubmit('confirmatory_tests')}
                                onEditSection={() => handleSectionEdit('confirmatory_tests')}
                            />
                            <DaySection
                                title="Management Plan"
                                icon="💊"
                                aiContent={analysisSections['management_plan'] || 'Management plan based on current clinical status and investigation results.'}
                                inputKey="management_plan"
                                placeholder={SECTION_PLACEHOLDERS['management_plan']}
                                value={sectionAnswers['management_plan']}
                                onChange={v => onSectionAnswerChange('management_plan', v)}
                                isSubmitted={submittedSections.has('management_plan')}
                                onSubmitSection={() => handleSectionSubmit('management_plan')}
                                onEditSection={() => handleSectionEdit('management_plan')}
                            />
                            <DaySection
                                title="Possible Complications & Prevention"
                                icon="⚠️"
                                aiContent={analysisSections['complications'] || fallbackComplications || 'Potential complications and preventive measures will be outlined here.'}
                            />
                        </div>
                    )}
                </div>

                {/* ── 2. CHECKLIST (collapsible, brief, below Assessment) ── */}
                {totalItems > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setChecklistOpen(prev => !prev)}
                            className="w-full text-left flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span>✔️</span>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Checklist</h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {completedCount}/{totalItems}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(completedCount / totalItems) * 100}%` }}
                                    />
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {checklistOpen ? '▾' : '▸'}
                                </span>
                            </div>
                        </button>
                        {checklistOpen && (
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
                        )}
                    </div>
                )}

                {/* ── 3. DAY NOTES SUMMARY (collapsible, editable clinical history) ── */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setNotesOpen(prev => !prev)}
                        className="w-full text-left flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span>📝</span>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Day Notes Summary</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            {editedNotes !== null && (
                                <span
                                    onClick={e => { e.stopPropagation(); setEditedNotes(null) }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                    Reset to auto-generated
                                </span>
                            )}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {notesOpen ? '▾' : '▸'}
                            </span>
                        </div>
                    </button>
                    {notesOpen && (
                    <div className="px-5 py-3 space-y-3">
                        {submittedSections.size === 0 && editedNotes === null ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                Submit sections in the Assessment above. Notes will appear here for review and editing before final submission.
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
                    )}
                </div>

            </div>
        </Card>
    )
}
