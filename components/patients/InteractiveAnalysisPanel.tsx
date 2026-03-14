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
    isLatest?: boolean
    onSectionSubmit?: (sectionKey: string, content: string) => void
}

const CATEGORY_ORDER = [
    'physical_examination', 'investigations', 'differential_diagnosis',
    'management_plan', 'complications', 'follow_up',
    'diagnostic', 'treatment', 'follow-up', 'referral', 'monitoring', 'lifestyle'
]

const CATEGORY_LABELS: Record<string, string> = {
    physical_examination: 'Physical Examination',
    investigations: 'Investigations',
    differential_diagnosis: 'Differential Diagnosis',
    management_plan: 'Management Plan',
    complications: 'Complications & Prevention',
    follow_up: 'Follow-up',
    diagnostic: 'Diagnostic',
    treatment: 'Treatment',
    'follow-up': 'Follow-up',
    referral: 'Referral',
    monitoring: 'Monitoring',
    lifestyle: 'Lifestyle'
}

const CATEGORY_ICONS: Record<string, string> = {
    physical_examination: '🩺',
    investigations: '🔬',
    differential_diagnosis: '🔀',
    management_plan: '💊',
    complications: '⚠️',
    follow_up: '📅',
    diagnostic: '🔬',
    treatment: '💊',
    'follow-up': '📅',
    referral: '🏥',
    monitoring: '📊',
    lifestyle: '🏃'
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

// Sections expanded by default
const DEFAULT_EXPANDED_SECTIONS = ['clinical summary', 'impression(s)', 'impressions']

// Sections that should NOT get inline input fields
const READ_ONLY_SECTIONS = ['clinical summary', 'impression(s)', 'impressions', 'differential diagnoses']

// Map display titles to section keys for data collection
function getSectionKey(title: string): string {
    const t = title.toLowerCase()
    if (t.includes('follow-up') || t.includes('gaps')) return 'follow_up_questions'
    if (t.includes('physical exam')) return 'physical_exam'
    if (t.includes('test interpretation')) return 'test_interpretation'
    if (t.includes('confirmatory')) return 'confirmatory_tests'
    if (t.includes('management')) return 'management_plan'
    if (t.includes('complication')) return 'complications'
    return t.replace(/\s+/g, '_')
}

const SECTION_PLACEHOLDERS: Record<string, string> = {
    follow_up_questions: 'Type your answers to the questions above...',
    physical_exam: 'Report physical examination findings...',
    test_interpretation: 'Enter new test results or updates...',
    confirmatory_tests: 'Report results of ordered tests...',
    management_plan: 'Note any medication changes, new orders...',
    complications: 'Report any complications observed or resolved...',
}

function SectionInput({ sectionKey, onSubmit }: {
    sectionKey: string
    onSubmit: (key: string, value: string) => void
}) {
    const [value, setValue] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const handleSubmit = () => {
        if (!value.trim()) return
        onSubmit(sectionKey, value.trim())
        setSubmitted(true)
    }

    return (
        <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600">
            {submitted ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <span>✓</span>
                    <span>Saved — your input will appear in the Day form below</span>
                </div>
            ) : (
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Your input
                    </label>
                    <textarea
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        rows={3}
                        placeholder={SECTION_PLACEHOLDERS[sectionKey] || 'Enter your findings...'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y bg-white dark:bg-gray-800 dark:text-gray-200"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim()}
                        className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Submit
                    </button>
                </div>
            )}
        </div>
    )
}

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

function CollapsibleTestBlock({ content }: { content: string }) {
    let blocks = content.split(/(?=\*\*\d*\.?\s*[A-Z])/).filter(b => b.trim())

    if (blocks.length <= 1) {
        blocks = content.split(/(?=^\d+\.\s)/m).filter(b => b.trim())
    }

    if (blocks.length <= 1 && content.length > 200) {
        return <TestBlockItem block={content} />
    }

    if (blocks.length <= 1) {
        return (
            <div
                className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatSectionContent(content) }}
            />
        )
    }

    return (
        <div className="space-y-3">
            {blocks.map((block, i) => (
                <TestBlockItem key={i} block={block} />
            ))}
        </div>
    )
}

function TestBlockItem({ block }: { block: string }) {
    const [expanded, setExpanded] = useState(false)

    const lines = block.trim().split('\n')
    const headerLine = lines[0] || ''
    const detailLines = lines.slice(1).join('\n').trim()

    return (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between gap-2 transition-colors"
            >
                <span
                    className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    dangerouslySetInnerHTML={{ __html: formatSectionContent(headerLine) }}
                />
                <span className="text-xs text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {expanded ? 'Hide' : 'More'}
                </span>
            </button>
            {expanded && detailLines && (
                <div
                    className="px-3 py-2 prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed border-t border-gray-100 dark:border-gray-600"
                    dangerouslySetInnerHTML={{ __html: formatSectionContent(detailLines) }}
                />
            )}
        </div>
    )
}

export function InteractiveAnalysisPanel({ analysis, isLatest, onSectionSubmit }: InteractiveAnalysisPanelProps) {
    const [todoItems, setTodoItems] = useState<TodoItemData[]>(analysis.todo_items || [])
    const [completedCount, setCompletedCount] = useState(analysis.completed_items || 0)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({})

    const sections = useMemo(() => {
        const parsed = parseAnalysisText(analysis.raw_analysis_text)

        // Find "Gaps in History" and "Follow-up Questions" sections
        const gapsIdx = parsed.findIndex(s => s.title.toLowerCase().includes('gaps'))
        const followUpIdx = parsed.findIndex(s => /follow.?up\s+questions/i.test(s.title))

        if (gapsIdx !== -1 && followUpIdx !== -1 && gapsIdx !== followUpIdx) {
            // Both exist — merge Gaps content into Follow-up Questions, then remove Gaps
            const gapsContent = mergeGapsContent(parsed[gapsIdx].content)
            parsed[followUpIdx] = {
                ...parsed[followUpIdx],
                content: parsed[followUpIdx].content + '\n' + gapsContent,
            }
            parsed.splice(gapsIdx, 1)
        } else if (gapsIdx !== -1) {
            // Only Gaps exists — transform it into Follow-up Questions
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
        setToggleErrors(prev => { const n = { ...prev }; delete n[itemId]; return n })

        try {
            const res = await fetch(`/api/analyses/${analysis.id}/todos`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ todo_item_id: itemId, is_checked: newChecked })
            })

            if (!res.ok) {
                throw new Error('Failed to update')
            }
        } catch {
            setTodoItems(prev =>
                prev.map(item => item.id === itemId ? { ...item, is_completed: !newChecked } : item)
            )
            setCompletedCount(prev => newChecked ? prev - 1 : prev + 1)
            setToggleErrors(prev => ({ ...prev, [itemId]: 'Failed to save — please try again' }))
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
        }
    }, [analysis.id])

    const triage = getTriageFromRiskLevel(analysis.risk_level)

    // Group items by category
    const grouped = todoItems.reduce((acc, item) => {
        const cat = item.category || 'uncategorized'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
    }, {} as Record<string, TodoItemData[]>)

    const sortedCategories = Object.entries(grouped).sort(([a], [b]) => {
        const ai = CATEGORY_ORDER.indexOf(a)
        const bi = CATEGORY_ORDER.indexOf(b)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

    const totalItems = todoItems.length

    return (
        <div className="space-y-4">
            {/* Risk level + metadata header */}
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
            </Card>

            {/* Analysis sections — each collapsible */}
            {sections.map((section) => {
                const isTestInterp = section.title.toLowerCase().includes('test interpretation')
                const displayTitle = getDisplayTitle(section.title)
                const isDefaultOpen = DEFAULT_EXPANDED_SECTIONS.includes(section.title.toLowerCase())
                const sectionKey = getSectionKey(section.title)
                const isReadOnly = READ_ONLY_SECTIONS.some(ro => section.title.toLowerCase().includes(ro))
                const showInput = isLatest && !isReadOnly && onSectionSubmit

                return (
                    <CollapsibleSection
                        key={section.order}
                        title={displayTitle}
                        icon={getSectionIcon(section.title)}
                        defaultOpen={isDefaultOpen}
                    >
                        {isTestInterp ? (
                            <CollapsibleTestBlock content={section.content} />
                        ) : (
                            <div
                                className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: formatSectionContent(section.content) }}
                            />
                        )}
                        {showInput && (
                            <SectionInput
                                sectionKey={sectionKey}
                                onSubmit={onSectionSubmit}
                            />
                        )}
                    </CollapsibleSection>
                )
            })}

            {/* Interactive Action Items Checklist */}
            {totalItems > 0 && (
                <Card header={{
                    title: 'Action Items Checklist',
                    subtitle: `${completedCount} / ${totalItems} completed`
                }}>
                    {/* Progress bar */}
                    <div className="mb-6">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: totalItems > 0 ? `${(completedCount / totalItems) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        {sortedCategories.map(([category, items]) => (
                            <div key={category}>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <span>{CATEGORY_ICONS[category] || '📋'}</span>
                                    {CATEGORY_LABELS[category] || category.replace(/[-_]/g, ' ')}
                                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500 normal-case tracking-normal">
                                        ({items.filter(i => i.is_completed).length}/{items.length})
                                    </span>
                                </h4>
                                <div className="space-y-2">
                                    {items
                                        .sort((a, b) => a.order_index - b.order_index)
                                        .map(item => (
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
                                                                <span className="text-xs text-blue-500 dark:text-blue-400">saving…</span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className={`text-xs mt-1 leading-relaxed ${item.is_completed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                                                {item.description}
                                                            </p>
                                                        )}
                                                        {toggleErrors[item.id] && (
                                                            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{toggleErrors[item.id]}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}
