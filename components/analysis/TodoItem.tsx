'use client'

/**
 * TodoItem Component
 * Renders a single todo item with checkbox, text parsing, and priority badge
 * Supports nested items via recursion
 */

import { TodoItemProps } from '@/lib/types/analysis';

/**
 * Parse item text to handle bold syntax (__text__)
 */
function parseItemText(text: string): React.ReactNode {
  const parts = text.split(/(__[^_]+__)/g);
  return parts.map((part, i) => {
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/**
 * Get priority badge color classes
 */
function getPriorityColor(priority: 'high' | 'medium' | 'low' | null): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return '';
  }
}

export default function TodoItem({ item, children = [], onToggle, depth }: TodoItemProps) {
  const indentClass = depth > 0 ? `ml-${Math.min(depth * 6, 18)}` : '';
  const hasChildren = children.length > 0;

  return (
    <div className={`todo-item ${indentClass}`}>
      <div className="flex items-start gap-3 py-2 group">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.is_checked}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          className="todo-checkbox mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          aria-label={`Mark "${item.item_text}" as ${item.is_checked ? 'incomplete' : 'complete'}`}
        />

        {/* Item content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span
              className={`text-sm ${
                item.is_checked
                  ? 'line-through text-gray-500'
                  : 'text-gray-900'
              }`}
            >
              {parseItemText(item.item_text)}
            </span>

            {/* Priority badge */}
            {item.priority && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border no-print ${getPriorityColor(item.priority)}`}
              >
                {item.priority}
              </span>
            )}
          </div>

          {/* Checked timestamp */}
          {item.is_checked && item.checked_at && (
            <div className="text-xs text-gray-400 mt-1 no-print">
              Completed {new Date(item.checked_at).toLocaleDateString()}
            </div>
          )}

          {/* Render children recursively */}
          {hasChildren && (
            <div className="mt-2">
              {children.map((child) => (
                <TodoItem
                  key={child.id}
                  item={child}
                  children={[]}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
