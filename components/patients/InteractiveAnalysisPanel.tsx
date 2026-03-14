'use client'

import { useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { parseAnalysisText, mergeGapsContent } from '@/lib/utils/parse-analysis'
import { getTriageFromRiskLevel, getTriageBadgeVariant, getTriageLabel } from '@/lib/utils/triage'

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

interface InteractiveAnalysisPanelProps {
    analysis: AnalysisData
    onRegenerate?: (analysisId: string) => void
}

const PRIORITY_VARIANTS: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
    urgent: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'default'
}

const SECTION_ICONS: Record<string, string> = {
    'Clinical Summary': '📋',
    'Follow-up Questions': '🔍',
    'Gaps in History': '🔍',
    'Test Interpretation': '🧪',
    'Impression(s)': '🎯',
    'Differential Diagnoses': '🔀',
    'Confirmatory Tests': '✅',
    'Management Plan': '💊',
    'Possible Complications': '⚠️',
}

const DEFAULT_EXPANDED_SECTIONS = ['clinical summary', 'impression(s)', 'impressions']

function getSectionIcon(title: string): string {
    for (const [key, icon] of Object.entries(SECTION_ICONS)) {
        if (title.toLowerCase().includes(key.toLowerCase())) return icon
    }
    return '📄'
}

function getDisplayTitle(title: string): string {
    if (title.toLowerCase().includes('gaps')) return 'Follow-up Questions'
    return title
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

function CollapsibleSection({ title, icon, children, defaultOpen = false }: {
    title: string
    icon: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)

    return (
        <Card>
            <button
                onClick={() => setOpen(prev => !prev)}
                className="w-full text-left flex items-center justify-between gap-2"
            >
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{icon}</span>
                    {title}
                </h3>
                <span className="text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {open ? '▾ Collapse' : '▸ Expand'}
                </span>
            </button>
            {open && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {children}
                </div>
            )}
        </Card>
    )
}

/**
 * Read-only analysis panel for past analyses.
 * Shows collapsible sections + action items checklist.
 */
export function InteractiveAnalysisPanel({ analysis, onRegenerate }: InteractiveAnalysisPanelProps) {
    const [todoItems, setTodoItems] = useState<TodoItemData[]>(analysis.todo_items || [])
    const [completedCount, setCompletedCount] = useState(analysis.completed_items || 0)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const [regenerating, setRegenerating] = useState(false)
    const [regenError, setRegenError] = useState<string | null>(null)
    const [checklistOpen, setChecklistOpen] = useState(false)

    const handleRegenerate = useCallback(async () => {
        if (!confirm('Regenerate this analysis? The AI will re-analyze with the latest prompt rules. This replaces the current analysis.')) return

        setRegenerating(true)
        setRegenError(null)

        try {
            const res = await fetch(`/api/analyses/${analysis.id}/regenerate`, {
                method: 'POST'
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Failed to regenerate')

            if (onRegenerate) {
                onRegenerate(analysis.id)
            } else {
                window.location.reload()
            }
        } catch (err: any) {
            setRegenError(err.message || 'Failed to regenerate analysis')
            setRegenerating(false)
        }
    }, [analysis.id, onRegenerate])

    const sections = useMemo(() => {
        const parsed = parseAnalysisText(analysis.raw_analysis_text)

        const gapsIdx = parsed.findIndex(s => s.title.toLowerCase().includes('gaps'))
        const followUpIdx = parsed.findIndex(s => /follow.?up\s+questions/i.test(s.title))

        if (gapsIdx !== -1 && followUpIdx !== -1 && gapsIdx !== followUpIdx) {
            const gapsContent = mergeGapsContent(parsed[gapsIdx].content)
            parsed[followUpIdx] = {
                ...parsed[followUpIdx],
                content: parsed[followUpIdx].content + '\n' + gapsContent,
            }
            parsed.splice(gapsIdx, 1)
        } else if (gapsIdx !== -1) {
            parsed[gapsIdx] = {
                ...parsed[gapsIdx],
                content: mergeGapsContent(parsed[gapsIdx].content),
            }
        }

        return parsed
    }, [analysis.raw_analysis_text])

    const handleToggle = useCallback(async (itemId: string, newChecked: boolean) => {
        setTodoItems(prev =>
            prev.map(item => item.id === itemId ? { ...item, is_completed: newChecked } : item)
        )
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
            setTodoItems(prev =>
                prev.map(item => item.id === itemId ? { ...item, is_completed: !newChecked } : item)
            )
            setCompletedCount(prev => newChecked ? prev - 1 : prev + 1)
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
        }
    }, [analysis.id])

    const triage = getTriageFromRiskLevel(analysis.risk_level)
    const allItemsSorted = [...todoItems].sort((a, b) => a.order_index - b.order_index)
    const totalItems = todoItems.length

    return (
        <div className="space-y-4">
            {/* Report header */}
            <Card header={{
                title: 'Clinical Report',
                subtitle: `Generated ${new Date(analysis.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }}>
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Triage:</span>
                    {triage ? (
                        <Badge variant={getTriageBadgeVariant(triage)}>
                            {getTriageLabel(triage)}
                        </Badge>
                    ) : (
                        <Badge variant="default">Unassessed</Badge>
                    )}
                </div>
                {analysis.model_used && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Model: {analysis.model_used}
                        {analysis.processing_time_ms && ` · ${(analysis.processing_time_ms / 1000).toFixed(1)}s`}
                    </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                    <button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                        {regenerating ? '↻ Regenerating...' : '↻ Regenerate Analysis'}
                    </button>
                    {regenError && (
                        <span className="text-xs text-red-500 dark:text-red-400">{regenError}</span>
                    )}
                </div>
            </Card>

            {/* Read-only analysis sections */}
            {sections.map((section) => {
                const displayTitle = getDisplayTitle(section.title)
                const isDefaultOpen = DEFAULT_EXPANDED_SECTIONS.includes(section.title.toLowerCase())

                return (
                    <CollapsibleSection
                        key={section.order}
                        title={displayTitle}
                        icon={getSectionIcon(section.title)}
                        defaultOpen={isDefaultOpen}
                    >
                        <div
                            className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatSectionContent(section.content) }}
                        />
                    </CollapsibleSection>
                )
            })}

            {/* Collapsible checklist */}
            {totalItems > 0 && (
                <Card>
                    <button
                        onClick={() => setChecklistOpen(prev => !prev)}
                        className="w-full text-left flex items-center justify-between gap-2"
                    >
                        <div className="flex items-center gap-2">
                            <span>📋</span>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Action Items Checklist
                            </h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {completedCount}/{totalItems}
                            </span>
                        </div>
                        <span className="text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">
                            {checklistOpen ? '▾ Collapse' : '▸ Expand'}
                        </span>
                    </button>

                    <div className="mt-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: totalItems > 0 ? `${(completedCount / totalItems) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>

                    {checklistOpen && (
                        <div className="mt-4 space-y-2">
                            {allItemsSorted.map(item => (
                                <div
                                    key={item.id}
                                    className={`rounded-lg border p-3 transition-colors ${item.is_completed
                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={item.is_completed}
                                            disabled={togglingIds.has(item.id)}
                                            onChange={e => handleToggle(item.id, e.target.checked)}
                                            className="mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-500 cursor-pointer focus:ring-blue-500 disabled:opacity-50"
                                            aria-label={item.title}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-sm font-medium ${item.is_completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {item.title}
                                                </span>
                                                <Badge variant={PRIORITY_VARIANTS[item.priority] || 'default'}>
                                                    {item.priority}
                                                </Badge>
                                                {togglingIds.has(item.id) && (
                                                    <span className="text-xs text-blue-500 dark:text-blue-400">saving...</span>
                                                )}
                                            </div>
                                            {item.description && (
                                                <p className={`text-xs mt-1 leading-relaxed ${item.is_completed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    )
}
