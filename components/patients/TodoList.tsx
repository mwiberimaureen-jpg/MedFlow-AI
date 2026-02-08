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
      diagnostic: '🔬',
      treatment: '💊',
      'follow-up': '📅',
      referral: '🏥',
      monitoring: '📊',
      lifestyle: '🏃'
    }
    return icons[category] || '📋'
  }

  const getCategoryLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
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
