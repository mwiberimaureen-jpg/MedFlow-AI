'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InteractiveAnalysisPanel } from './InteractiveAnalysisPanel'
import { DayProgressForm } from './DayProgressForm'
import { DischargeSummaryView } from './DischargeSummaryView'
import { DischargeSummaryResponse } from '@/lib/types/patient'

interface Analysis {
    id: string
    analysis_version: string | null
    raw_analysis_text: string
    todo_items: any[]
    summary: string
    risk_level: string
    created_at: string
    total_items: number
    completed_items: number
    model_used?: string
    processing_time_ms?: number
    user_feedback?: string | null
}

interface Patient {
    id: string
    patient_name: string
    metadata?: Record<string, any> | null
    status: string
}

interface AdmissionTimelineProps {
    patient: Patient
    initialAnalyses: Analysis[]
}

function getVersionLabel(version: string | null, index: number): string {
    if (version === 'admission') return 'Analysis at Admission'
    if (version === 'discharge') return 'Discharge Summary'
    if (version?.startsWith('day_')) {
        const dayNum = parseInt(version.replace('day_', ''), 10)
        const ordinals: Record<number, string> = {
            1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
            6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten'
        }
        const label = ordinals[dayNum] ? `Day ${ordinals[dayNum]}` : `Day ${dayNum}`
        return `${label} of Admission Analysis`
    }
    // Fallback for legacy analyses without version
    return index === 0 ? 'Analysis at Admission' : `Analysis ${index + 1}`
}

function getNextDayNumber(analyses: Analysis[]): number {
    const dayAnalyses = analyses.filter(a => a.analysis_version?.startsWith('day_'))
    if (dayAnalyses.length === 0) return 1
    const maxDay = Math.max(...dayAnalyses.map(a => parseInt(a.analysis_version!.replace('day_', ''), 10)))
    return maxDay + 1
}

function DayNotes({ analysisId }: { analysisId: string }) {
    const storageKey = `day-notes-${analysisId}`
    const [open, setOpen] = useState(false)
    const [text, setText] = useState('')

    useEffect(() => {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
            setText(saved)
            setOpen(true)
        }
    }, [storageKey])

    const handleChange = useCallback((value: string) => {
        setText(value)
        if (value.trim()) {
            localStorage.setItem(storageKey, value)
        } else {
            localStorage.removeItem(storageKey)
        }
    }, [storageKey])

    return (
        <div className="mt-2">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
                <span>{open ? '▾' : '▸'}</span>
                <span>{open ? 'Hide Notes' : 'Add Notes'}</span>
            </button>
            {open && (
                <textarea
                    value={text}
                    onChange={e => handleChange(e.target.value)}
                    rows={4}
                    placeholder="Write your own admission notes here… (saved locally)"
                    className="mt-2 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                />
            )}
        </div>
    )
}

/**
 * Extract follow-up questions and PE checklist from the latest analysis markdown.
 * The raw_analysis_text contains sections like:
 *   ## Gaps in History / Outstanding Questions
 *   **Follow-up Questions:**
 *   1. Question text
 *   **Physical Exam Checklist:**
 *   - [ ] Exam item
 */
function extractPromptsFromAnalysis(rawText: string): {
    followUpQuestions: string[]
    peChecklist: string[]
} {
    const followUpQuestions: string[] = []
    const peChecklist: string[] = []

    if (!rawText) return { followUpQuestions, peChecklist }

    // Extract follow-up questions: numbered items after "Follow-up Questions"
    const fqMatch = rawText.match(/\*\*Follow-up Questions:?\*\*\s*\n([\s\S]*?)(?=\n\*\*|\n##|$)/)
    if (fqMatch?.[1]) {
        const lines = fqMatch[1].trim().split('\n')
        for (const line of lines) {
            const cleaned = line.replace(/^\d+\.\s*/, '').trim()
            if (cleaned.length > 5) followUpQuestions.push(cleaned)
        }
    }

    // Extract PE checklist: checkbox items after "Physical Exam Checklist"
    const peMatch = rawText.match(/\*\*Physical Exam Checklist:?\*\*\s*\n([\s\S]*?)(?=\n\*\*|\n##|$)/)
    if (peMatch?.[1]) {
        const lines = peMatch[1].trim().split('\n')
        for (const line of lines) {
            const cleaned = line.replace(/^-\s*\[.\]\s*/, '').replace(/^-\s*/, '').trim()
            if (cleaned.length > 5) peChecklist.push(cleaned)
        }
    }

    return { followUpQuestions, peChecklist }
}

function parseDischargeSummary(rawText: string): DischargeSummaryResponse | null {
    try {
        return JSON.parse(rawText)
    } catch {
        return null
    }
}

export function AdmissionTimeline({ patient, initialAnalyses }: AdmissionTimelineProps) {
    const [analyses, setAnalyses] = useState<Analysis[]>(initialAnalyses)
    const [discharging, setDischarging] = useState(false)
    const [dischargeError, setDischargeError] = useState<string | null>(null)
    const [sectionAnswers, setSectionAnswers] = useState<Record<string, string>>({})

    const handleSectionSubmit = useCallback((sectionKey: string, content: string) => {
        setSectionAnswers(prev => ({ ...prev, [sectionKey]: content }))
    }, [])

    const isDischarged = patient.metadata?.admission_status === 'discharged'

    const dischargeDate = patient.metadata?.discharge_date
        ? new Date(patient.metadata.discharge_date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : null

    // Separate discharge analysis from regular analyses
    const regularAnalyses = analyses.filter(a => a.analysis_version !== 'discharge')
    const dischargeAnalysis = analyses.find(a => a.analysis_version === 'discharge')

    const nextDayNumber = getNextDayNumber(regularAnalyses)

    // Extract prompts from latest analysis for the next-day form
    const latestRegular = regularAnalyses.length > 0 ? regularAnalyses[regularAnalyses.length - 1] : null
    const { followUpQuestions, peChecklist } = latestRegular
        ? extractPromptsFromAnalysis(latestRegular.raw_analysis_text)
        : { followUpQuestions: [], peChecklist: [] }

    const handleDailyAnalysisComplete = (newAnalysis: Analysis) => {
        setAnalyses(prev => [...prev, newAnalysis])
    }

    const handleDischarge = async () => {
        if (!confirm('Are you sure you want to discharge this patient? A discharge summary will be generated.')) return

        setDischarging(true)
        setDischargeError(null)

        try {
            const res = await fetch(`/api/patients/${patient.id}/discharge`, {
                method: 'PATCH'
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Failed to discharge patient')

            // Reload page to show updated metadata + discharge summary
            window.location.reload()

        } catch (err: any) {
            setDischargeError(err.message || 'Failed to discharge patient')
            setDischarging(false)
        }
    }

    if (analyses.length === 0) {
        return (
            <Card>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-4">📋</div>
                    <p>No analyses yet. Submit the patient history to start.</p>
                </div>
            </Card>
        )
    }

    return (
        <div className="space-y-8">
            {/* Render each regular analysis with its label */}
            {regularAnalyses.map((analysis, index) => (
                <div key={analysis.id} className="space-y-2">
                    {/* Section divider + label */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full whitespace-nowrap">
                            {getVersionLabel(analysis.analysis_version, index)}
                        </span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>

                    {/* If this day had progress notes, show them first */}
                    {analysis.user_feedback && (
                        <Card className="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20">
                            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                📝 Progress Notes
                            </h4>
                            <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                                {analysis.user_feedback}
                            </p>
                        </Card>
                    )}

                    {/* The analysis panel */}
                    <InteractiveAnalysisPanel
                        analysis={analysis}
                        isLatest={!isDischarged && index === regularAnalyses.length - 1}
                        onSectionSubmit={index === regularAnalyses.length - 1 ? handleSectionSubmit : undefined}
                    />

                    {/* Per-day personal notes (localStorage) */}
                    <DayNotes analysisId={analysis.id} />
                </div>
            ))}

            {/* Form for the next day — only if not discharged */}
            {!isDischarged && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full whitespace-nowrap">
                            {nextDayNumber === 1 ? 'Day One of Admission' : `Day ${nextDayNumber} of Admission`}
                        </span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <DayProgressForm
                        patientId={patient.id}
                        dayNumber={nextDayNumber}
                        onAnalysisComplete={handleDailyAnalysisComplete}
                        previousFollowUpQuestions={followUpQuestions}
                        previousPEChecklist={peChecklist}
                        prefilled={sectionAnswers}
                    />
                </div>
            )}

            {/* Discharge section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {isDischarged ? (
                    <div className="space-y-6">
                        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✅</span>
                                <div>
                                    <p className="font-semibold text-green-800 dark:text-green-300">Patient Discharged</p>
                                    {dischargeDate && (
                                        <p className="text-sm text-green-700 dark:text-green-400">Discharged on {dischargeDate}</p>
                                    )}
                                </div>
                                <Badge variant="success">Discharged</Badge>
                            </div>
                        </Card>

                        {/* Render discharge summary if available */}
                        {dischargeAnalysis && (() => {
                            const dischargeSummary = parseDischargeSummary(dischargeAnalysis.raw_analysis_text)
                            if (!dischargeSummary) return null
                            return (
                                <Card>
                                    <DischargeSummaryView
                                        summary={dischargeSummary}
                                        patientName={patient.patient_name}
                                        dischargeDate={patient.metadata?.discharge_date}
                                    />
                                </Card>
                            )
                        })()}
                    </div>
                ) : (
                    <div className="flex flex-col items-start gap-2">
                        {dischargeError && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm w-full">
                                {dischargeError}
                            </div>
                        )}
                        <Button
                            variant="danger"
                            onClick={handleDischarge}
                            loading={discharging}
                            disabled={discharging}
                            className="max-w-xs"
                        >
                            {discharging ? 'Generating discharge summary...' : '🏥 Discharge Patient'}
                        </Button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            This will mark the patient as discharged, generate a discharge summary, and close the admission workflow.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
