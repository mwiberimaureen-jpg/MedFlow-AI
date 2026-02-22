'use client'

import { useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { parseAnalysisText } from '@/lib/utils/parse-analysis'

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
    'Gaps in History': '🔍',
    'Test Interpretation': '🧪',
    'Impression(s)': '🎯',
    'Differential Diagnoses': '🔀',
    'Confirmatory Tests': '✅',
    'Management Plan': '💊',
    'Possible Complications': '⚠️',
}

function getSectionIcon(title: string): string {
    for (const [key, icon] of Object.entries(SECTION_ICONS)) {
        if (title.toLowerCase().includes(key.toLowerCase())) return icon
    }
    return '📄'
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

/**
 * Merge "Missing Information" into "Follow-up Questions" for the Gaps section.
 * Old analyses may still have both sub-headers in the raw text.
 */
function mergeGapsContent(content: string): string {
    // Remove the "Missing Information" sub-header and its items,
    // fold them into the follow-up questions as numbered items
    const missingMatch = content.match(/\*\*Missing Information:?\*\*\s*\n([\s\S]*?)(?=\*\*|$)/)
    const followUpMatch = content.match(/\*\*Follow-up Questions:?\*\*\s*\n([\s\S]*?)(?=\*\*|$)/)

    if (!missingMatch) return content

    const missingItems = missingMatch[1].trim().split('\n').filter(l => l.trim().length > 0)
    // Convert missing items into question form and prepend to follow-up
    const asQuestions = missingItems.map(item => {
        const clean = item.replace(/^[-*]\s*/, '').trim()
        return `- ${clean}`
    })

    let merged = content
    // Remove the missing information block
    merged = merged.replace(/\*\*Missing Information:?\*\*\s*\n[\s\S]*?(?=\*\*|$)/, '')
    // If there are follow-up questions, append missing items to them
    if (followUpMatch) {
        const insertPoint = merged.indexOf(followUpMatch[1]) + followUpMatch[1].length
        merged = merged.slice(0, insertPoint) + '\n' + asQuestions.join('\n') + merged.slice(insertPoint)
    } else {
        // No follow-up section, create one
        merged = '**Follow-up Questions:**\n' + asQuestions.join('\n') + '\n\n' + merged
    }
    return merged.trim()
}

/**
 * Collapsible test interpretation block.
 * Shows the test name as a header, with interpretation collapsed by default.
 */
function CollapsibleTestBlock({ content }: { content: string }) {
    // Split by test blocks: **1. Test Name** ... **2. Test Name** ...
    const blocks = content.split(/(?=\*\*\d+\.\s)/).filter(b => b.trim())

    if (blocks.length === 0) {
        return (
            <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
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

    // Extract the first line (test name) and the rest (details)
    const lines = block.trim().split('\n')
    const headerLine = lines[0] || ''
    const detailLines = lines.slice(1).join('\n').trim()

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-2 transition-colors"
            >
                <span
                    className="text-sm font-medium text-gray-900"
                    dangerouslySetInnerHTML={{ __html: formatSectionContent(headerLine) }}
                />
                <span className="text-xs text-blue-600 flex-shrink-0">
                    {expanded ? 'Hide' : 'More'}
                </span>
            </button>
            {expanded && detailLines && (
                <div
                    className="px-3 py-2 prose prose-sm max-w-none text-gray-700 leading-relaxed border-t border-gray-100"
                    dangerouslySetInnerHTML={{ __html: formatSectionContent(detailLines) }}
                />
            )}
        </div>
    )
}

export function InteractiveAnalysisPanel({ analysis }: InteractiveAnalysisPanelProps) {
    const [todoItems, setTodoItems] = useState<TodoItemData[]>(analysis.todo_items || [])
    const [completedCount, setCompletedCount] = useState(analysis.completed_items || 0)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({})

    const sections = useMemo(() => {
        const parsed = parseAnalysisText(analysis.raw_analysis_text)
        // Merge missing information into follow-up questions for Gaps section
        return parsed.map(s => {
            if (s.title.toLowerCase().includes('gaps')) {
                return { ...s, content: mergeGapsContent(s.content) }
            }
            return s
        })
    }, [analysis.raw_analysis_text])

    const handleToggle = useCallback(async (itemId: string, newChecked: boolean) => {
        // Optimistic update
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
            // Revert on failure
            setTodoItems(prev =>
                prev.map(item => item.id === itemId ? { ...item, is_completed: !newChecked } : item)
            )
            setCompletedCount(prev => newChecked ? prev - 1 : prev + 1)
            setToggleErrors(prev => ({ ...prev, [itemId]: 'Failed to save — please try again' }))
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
        }
    }, [analysis.id])

    const getRiskBadge = (risk: string): 'danger' | 'warning' | 'success' => {
        const map: Record<string, 'danger' | 'warning' | 'success'> = {
            high: 'danger', medium: 'warning', low: 'success'
        }
        return map[risk] || 'success'
    }

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
                    <span className="text-sm font-medium text-gray-600">Risk Level:</span>
                    <Badge variant={getRiskBadge(analysis.risk_level)}>
                        {analysis.risk_level?.toUpperCase()}
                    </Badge>
                </div>
                {analysis.model_used && (
                    <div className="text-xs text-gray-500">
                        Model: {analysis.model_used}
                        {analysis.processing_time_ms && ` · ${(analysis.processing_time_ms / 1000).toFixed(1)}s`}
                    </div>
                )}
            </Card>

            {/* Analysis sections */}
            {sections.map((section) => {
                const isTestInterp = section.title.toLowerCase().includes('test interpretation')
                return (
                    <Card key={section.order}>
                        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>{getSectionIcon(section.title)}</span>
                            {section.title}
                        </h3>
                        {isTestInterp ? (
                            <CollapsibleTestBlock content={section.content} />
                        ) : (
                            <div
                                className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: formatSectionContent(section.content) }}
                            />
                        )}
                    </Card>
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
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: totalItems > 0 ? `${(completedCount / totalItems) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        {sortedCategories.map(([category, items]) => (
                            <div key={category}>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <span>{CATEGORY_ICONS[category] || '📋'}</span>
                                    {CATEGORY_LABELS[category] || category.replace(/[-_]/g, ' ')}
                                    <span className="text-xs font-normal text-gray-400 normal-case tracking-normal">
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
                                                        ? 'bg-green-50 border-green-200'
                                                        : 'bg-gray-50 border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_completed}
                                                        disabled={togglingIds.has(item.id)}
                                                        onChange={e => handleToggle(item.id, e.target.checked)}
                                                        className="mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 cursor-pointer focus:ring-blue-500 disabled:opacity-50"
                                                        aria-label={item.title}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-sm font-medium ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                                {item.title}
                                                            </span>
                                                            <Badge variant={PRIORITY_VARIANTS[item.priority] || 'default'}>
                                                                {item.priority}
                                                            </Badge>
                                                            {togglingIds.has(item.id) && (
                                                                <span className="text-xs text-blue-500">saving…</span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className={`text-xs mt-1 leading-relaxed ${item.is_completed ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {item.description}
                                                            </p>
                                                        )}
                                                        {toggleErrors[item.id] && (
                                                            <p className="text-xs text-red-500 mt-1">{toggleErrors[item.id]}</p>
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
