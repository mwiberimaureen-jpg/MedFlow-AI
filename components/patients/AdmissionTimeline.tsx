'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InteractiveAnalysisPanel } from './InteractiveAnalysisPanel'
import { DayAdmissionCard } from './DayAdmissionCard'
import { DischargeSummaryView } from './DischargeSummaryView'
import { DischargeSummaryResponse } from '@/lib/types/patient'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'
import { parseAnalysisText } from '@/lib/utils/parse-analysis'

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
    return index === 0 ? 'Analysis at Admission' : `Analysis ${index + 1}`
}

function getDayLabel(n: number): string {
    const ordinals: Record<number, string> = {
        1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
        6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten'
    }
    return ordinals[n] ? `Day ${ordinals[n]}` : `Day ${n}`
}

/**
 * Calculate next day number from admission date and existing analyses.
 */
function getNextDayNumber(analyses: Analysis[]): number {
    const admissionAnalysis = analyses.find(a => a.analysis_version === 'admission')
    let calendarDay = 1
    if (admissionAnalysis) {
        const admissionDate = new Date(admissionAnalysis.created_at)
        const now = new Date()
        const admStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), admissionDate.getDate())
        const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const diffMs = nowStart.getTime() - admStart.getTime()
        calendarDay = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
    }

    const dayAnalyses = analyses.filter(a => a.analysis_version?.startsWith('day_'))
    let maxExistingDay = 0
    if (dayAnalyses.length > 0) {
        maxExistingDay = Math.max(...dayAnalyses.map(a => parseInt(a.analysis_version!.replace('day_', ''), 10)))
    }

    return Math.max(calendarDay, maxExistingDay + 1)
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
    const [submitting, setSubmitting] = useState(false)

    // Persist section answers in localStorage
    const storageKey = `section-answers-${patient.id}`
    const [sectionAnswers, setSectionAnswers] = useState<Record<string, string>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const saved = localStorage.getItem(storageKey)
            return saved ? JSON.parse(saved) : {}
        } catch {
            return {}
        }
    })

    const handleSectionAnswerChange = useCallback((key: string, value: string) => {
        setSectionAnswers(prev => {
            const updated = { ...prev, [key]: value }
            try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
            return updated
        })
    }, [storageKey])

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
    const dayLabel = getDayLabel(nextDayNumber)

    // Latest regular analysis provides AI content for the day card
    const latestRegular = regularAnalyses.length > 0 ? regularAnalyses[regularAnalyses.length - 1] : null

    // Extract clinical summary from latest analysis
    const clinicalSummary = latestRegular
        ? parseAnalysisText(latestRegular.raw_analysis_text).find(s =>
            s.title.toLowerCase().includes('clinical summary')
        )?.content || latestRegular.summary
        : null

    const latestTriage = latestRegular ? getTriageFromRiskLevel(latestRegular.risk_level) : null

    // Past analyses = all except the latest (which feeds the day card)
    const pastAnalyses = regularAnalyses.length > 1 ? regularAnalyses.slice(0, -1) : []

    const handleDailyAnalysisComplete = (newAnalysis: Analysis) => {
        setAnalyses(prev => [...prev, newAnalysis])
        setSectionAnswers({})
        try { localStorage.removeItem(storageKey) } catch {}
        try { localStorage.removeItem(`submitted-sections-${patient.id}`) } catch {}
    }

    const handleSubmitDay = async (notes: string) => {
        setSubmitting(true)
        try {
            const response = await fetch(`/api/patients/${patient.id}/daily-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progress_notes: notes,
                    day_number: nextDayNumber,
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate analysis')
            }

            handleDailyAnalysisComplete(data.analysis)
        } catch (err: any) {
            alert(err.message || 'An error occurred')
        } finally {
            setSubmitting(false)
        }
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
{/* 1. Clinical Summary — always visible at the top */}
            {clinicalSummary && (
                <Card header={{
                    title: 'Clinical Summary',
                    subtitle: latestRegular
                        ? `Updated ${new Date(latestRegular.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : undefined
                }}>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Triage:</span>
                        {latestTriage ? (
                            <Badge variant={getTriageBadgeVariant(latestTriage)}>
                                {getTriageLabel(latestTriage)}
                            </Badge>
                        ) : (
                            <Badge variant="default">Unassessed</Badge>
                        )}
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {clinicalSummary}
                    </div>
                    {latestRegular?.model_used && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                            Model: {latestRegular.model_used}
                            {latestRegular.processing_time_ms && ` · ${(latestRegular.processing_time_ms / 1000).toFixed(1)}s`}
                        </div>
                    )}
                </Card>
            )}

            {/* 2. Past analyses (read-only, collapsed) */}
            {pastAnalyses.length > 0 && (
                <div className="space-y-6">
                    {pastAnalyses.map((analysis, index) => (
                        <div key={analysis.id} className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full whitespace-nowrap">
                                    {getVersionLabel(analysis.analysis_version, index)}
                                </span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            </div>

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

                            <InteractiveAnalysisPanel
                                analysis={analysis}
                                onRegenerate={() => window.location.reload()}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* 3. Current Day — unified card with AI content + input spaces */}
            {!isDischarged && latestRegular && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full whitespace-nowrap">
                            {dayLabel} of Admission
                        </span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>

                    <DayAdmissionCard
                        patientId={patient.id}
                        dayNumber={nextDayNumber}
                        analysis={latestRegular}
                        sectionAnswers={sectionAnswers}
                        onSectionAnswerChange={handleSectionAnswerChange}
                        onSubmitDay={handleSubmitDay}
                        submitting={submitting}
                        dayLabel={dayLabel}
                    />
                </div>
            )}

            {/* 4. Discharge section */}
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
