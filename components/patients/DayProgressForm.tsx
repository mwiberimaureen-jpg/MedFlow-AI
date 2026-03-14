'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface DayProgressFormProps {
    patientId: string
    dayNumber: number
    onAnalysisComplete: (analysis: any) => void
    previousFollowUpQuestions?: string[]
    previousPEChecklist?: string[]
    prefilled?: Record<string, string>
}

const DAY_ORDINALS: Record<number, string> = {
    1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
    6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
}

function getDayLabel(n: number): string {
    return DAY_ORDINALS[n] ? `Day ${DAY_ORDINALS[n]}` : `Day ${n}`
}

interface SectionConfig {
    key: string
    label: string
    icon: string
    rows: number
    placeholder: string
    prompts?: string[]
    promptLabel?: string
}

// Map section answer keys from InteractiveAnalysisPanel to form section keys
const PREFILL_MAP: Record<string, string> = {
    follow_up_questions: 'hpi',
    physical_exam: 'physical_exam',
    test_interpretation: 'tests',
    confirmatory_tests: 'tests',
    management_plan: 'medications',
    complications: 'hpi',
}

export function DayProgressForm({
    patientId,
    dayNumber,
    onAnalysisComplete,
    previousFollowUpQuestions,
    previousPEChecklist,
    prefilled,
}: DayProgressFormProps) {
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [sections, setSections] = useState<Record<string, string>>({
        hpi: '',
        ros: '',
        vitals: '',
        physical_exam: '',
        tests: '',
        medications: '',
    })

    // When inline section answers arrive, populate the corresponding form fields
    useEffect(() => {
        if (!prefilled || Object.keys(prefilled).length === 0) return

        setSections(prev => {
            const updated = { ...prev }
            for (const [answerKey, value] of Object.entries(prefilled)) {
                const formKey = PREFILL_MAP[answerKey]
                if (!formKey || !value) continue

                // Append if the form field already has content (e.g. multiple answers map to 'hpi')
                if (updated[formKey] && updated[formKey].trim()) {
                    // Don't duplicate if already contains this value
                    if (!updated[formKey].includes(value)) {
                        updated[formKey] = updated[formKey] + '\n\n' + value
                    }
                } else {
                    updated[formKey] = value
                }
            }
            return updated
        })
    }, [prefilled])

    const dayLabel = getDayLabel(dayNumber)

    const sectionConfigs: SectionConfig[] = [
        {
            key: 'hpi',
            label: 'History Update / HPI',
            icon: '📝',
            rows: 3,
            placeholder: 'Any new symptoms, changes since last assessment, updated obstetric/medical status, patient complaints today...',
            prompts: previousFollowUpQuestions,
            promptLabel: 'Follow-up questions from previous analysis',
        },
        {
            key: 'ros',
            label: 'Review of Systems',
            icon: '🔍',
            rows: 2,
            placeholder: 'GI: no nausea/vomiting. Respiratory: no SOB. CVS: no chest pain...',
        },
        {
            key: 'vitals',
            label: 'Vital Signs',
            icon: '📊',
            rows: 2,
            placeholder: 'BP 120/80, HR 78, Temp 36.5°C, RR 18, SpO2 98%...',
        },
        {
            key: 'physical_exam',
            label: 'Physical Examination Findings',
            icon: '🩺',
            rows: 3,
            placeholder: 'General: alert, not in distress. Abdomen: soft, non-tender...',
            prompts: previousPEChecklist,
            promptLabel: 'Physical exam checklist from previous analysis',
        },
        {
            key: 'tests',
            label: 'New Test Results',
            icon: '🧪',
            rows: 3,
            placeholder: 'HB 10.2, WBC 8.5, Platelets 250. Ultrasound: no free fluid...',
        },
        {
            key: 'medications',
            label: 'Medication Changes',
            icon: '💊',
            rows: 2,
            placeholder: 'Started Amoxicillin 500mg PO TDS. Stopped IV fluids. Dose adjustment: Furosemide 40mg → 20mg...',
        },
    ]

    const handleSectionChange = (key: string, value: string) => {
        setSections(prev => ({ ...prev, [key]: value }))
    }

    const hasContent = Object.values(sections).some(v => v.trim().length > 0)

    const assembleNotes = (): string => {
        const parts: string[] = []

        const sectionMap: Record<string, string> = {
            hpi: 'HISTORY UPDATE / HPI',
            ros: 'REVIEW OF SYSTEMS',
            vitals: 'VITAL SIGNS',
            physical_exam: 'PHYSICAL EXAMINATION',
            tests: 'TEST RESULTS',
            medications: 'MEDICATION CHANGES',
        }

        for (const [key, header] of Object.entries(sectionMap)) {
            const value = sections[key]?.trim()
            if (value) {
                parts.push(`${header}:\n${value}`)
            }
        }

        return parts.join('\n\n')
    }

    const handleSubmit = async () => {
        const notes = assembleNotes()

        if (notes.length < 10) {
            setError('Please fill in at least one section with enough detail (minimum 10 characters total)')
            return
        }

        setError(null)
        setLoading(true)

        try {
            const response = await fetch(`/api/patients/${patientId}/daily-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progress_notes: notes,
                    day_number: dayNumber,
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate analysis')
            }

            onAnalysisComplete(data.analysis)
            setSections({ hpi: '', ros: '', vitals: '', physical_exam: '', tests: '', medications: '' })
            setSubmitted(true)

        } catch (err: any) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return null
    }

    return (
        <Card
            header={{
                title: `${dayLabel} of Admission`,
                subtitle: 'Fill in the relevant sections below — empty sections will be skipped'
            }}
        >
            <div className="space-y-5">
                {sectionConfigs.map(config => (
                    <div key={config.key} className="space-y-2">
                        <label
                            htmlFor={`section-${config.key}`}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                        >
                            <span>{config.icon}</span>
                            {config.label}
                        </label>

                        {/* Show prompts from previous analysis if available */}
                        {config.prompts && config.prompts.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                                    {config.promptLabel}:
                                </p>
                                <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                                    {config.prompts.map((prompt, i) => (
                                        <li key={i} className="flex gap-1.5">
                                            <span className="text-amber-500 flex-shrink-0">{config.key === 'physical_exam' ? '☐' : `${i + 1}.`}</span>
                                            <span>{prompt}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <textarea
                            id={`section-${config.key}`}
                            value={sections[config.key]}
                            onChange={e => handleSectionChange(config.key, e.target.value)}
                            rows={config.rows}
                            placeholder={config.placeholder}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y bg-white dark:bg-gray-800 dark:text-gray-200"
                            disabled={loading}
                        />
                    </div>
                ))}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
                        {error}
                    </div>
                )}

                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={loading || !hasContent}
                    className="max-w-xs"
                >
                    {loading ? `Generating ${dayLabel} Analysis…` : `Submit ${dayLabel} Notes`}
                </Button>
            </div>
        </Card>
    )
}
