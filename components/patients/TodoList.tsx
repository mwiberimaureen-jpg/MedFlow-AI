'use client'

import { Badge } from '@/components/ui/Badge'
import { TodoItem } from '@/lib/types/patient'

interface TodoListProps {
  items: TodoItem[]
}

export function TodoList({ items }: TodoListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No action items generated
      </div>
    )
  }

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, TodoItem[]>)

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
      urgent: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'default'
    }
    return variants[priority] || 'default'
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      physical_examination: '🩺',
      investigations: '🔬',
      differential_diagnosis: '🔀',
      management_plan: '💊',
      complications: '⚠️',
      follow_up: '📅',
      // Legacy categories for backward compatibility
      diagnostic: '🔬',
      treatment: '💊',
      'follow-up': '📅',
      referral: '🏥',
      monitoring: '📊',
      lifestyle: '🏃'
    }
    return icons[category] || '📋'
  }

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

  // Define display order for categories
  const CATEGORY_ORDER = [
    'physical_examination', 'investigations', 'differential_diagnosis',
    'management_plan', 'complications', 'follow_up',
    'diagnostic', 'treatment', 'follow-up', 'referral', 'monitoring', 'lifestyle'
  ]

  const getCategoryLabel = (category: string) => {
    return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/[-_]/g, ' ')
  }

  // Sort category entries by defined order
  const sortedEntries = Object.entries(groupedItems).sort(([a], [b]) => {
    const indexA = CATEGORY_ORDER.indexOf(a)
    const indexB = CATEGORY_ORDER.indexOf(b)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  return (
    <div className="space-y-6">
      {sortedEntries.map(([category, categoryItems]) => (
        <div key={category}>
          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>{getCategoryIcon(category)}</span>
            {getCategoryLabel(category)}
            <span className="text-sm font-normal text-gray-500">
              ({categoryItems.length})
            </span>
          </h4>
          <div className="space-y-3">
            {categoryItems
              .sort((a, b) => a.order_index - b.order_index)
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium text-gray-900">
                          {item.title}
                        </h5>
                        <Badge variant={getPriorityBadge(item.priority)}>
                          {item.priority}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      readOnly
                      className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
