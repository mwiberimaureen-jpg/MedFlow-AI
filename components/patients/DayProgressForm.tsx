'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface DayProgressFormProps {
    patientId: string
    dayNumber: number
    onAnalysisComplete: (analysis: any) => void
}

const DAY_ORDINALS: Record<number, string> = {
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
}

function getDayLabel(n: number): string {
    return DAY_ORDINALS[n] ? `Day ${DAY_ORDINALS[n]}` : `Day ${n}`
}

export function DayProgressForm({ patientId, dayNumber, onAnalysisComplete }: DayProgressFormProps) {
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const dayLabel = getDayLabel(dayNumber)

    const handleSubmit = async () => {
        if (!notes.trim() || notes.trim().length < 10) {
            setError('Please enter at least 10 characters of progress notes')
            return
        }

        setError(null)
        setLoading(true)

        try {
            const response = await fetch(`/api/patients/${patientId}/daily-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progress_notes: notes.trim(),
                    day_number: dayNumber
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate analysis')
            }

            onAnalysisComplete(data.analysis)
            setNotes('')

        } catch (err: any) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card
            header={{
                title: `${dayLabel} of Admission`,
                subtitle: 'Enter progress notes and test results to generate analysis'
            }}
        >
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor={`day-notes-${dayNumber}`}
                        className="block text-sm font-medium text-gray-700 mb-2"
                    >
                        Progress Notes & New Test Results
                    </label>
                    <textarea
                        id={`day-notes-${dayNumber}`}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={8}
                        placeholder={`Enter ${dayLabel} progress notes here…\n\nInclude:\n- Patient's current status (improving/deteriorating/stable)\n- Any new symptoms or complaints\n- New test results (e.g. Creatinine now 1.8, BP 140/90)\n- Changes in medications or management\n- Physical exam findings today`}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y"
                        disabled={loading}
                    />
                    <div className="mt-1 text-xs text-gray-500 text-right">
                        {notes.length} characters
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                        {error}
                    </div>
                )}

                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={loading || !notes.trim()}
                    className="max-w-xs"
                >
                    {loading ? `Generating ${dayLabel} Analysis… (30–60s)` : `Generate ${dayLabel} Analysis`}
                </Button>
            </div>
        </Card>
    )
}
