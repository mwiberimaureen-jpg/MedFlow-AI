'use client'

/**
 * TodoListDisplay Component
 * Groups todos by category and renders them with tree structure
 */

import { TodoListDisplayProps, TodoItem as TodoItemType } from '@/lib/types/analysis';
import TodoItem from './TodoItem';

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  physical_examination: 'Physical Examination',
  investigations: 'Investigations',
  differential_diagnosis: 'Differential Diagnosis',
  management_plan: 'Management Plan',
  complications: 'Complications & Prevention',
  follow_up: 'Follow-up',
  // Legacy categories
  physical_exam: 'Physical Examination',
  tests: 'Investigations & Tests',
  management: 'Management Plan',
  differential: 'Differential Diagnosis',
  diagnostic: 'Diagnostic',
  treatment: 'Treatment',
  'follow-up': 'Follow-up',
  referral: 'Referral',
  monitoring: 'Monitoring',
  lifestyle: 'Lifestyle',
};

// Build tree structure from flat todo items
function buildTodoTree(items: TodoItemType[]): Map<string | null, TodoItemType[]> {
  const tree = new Map<string | null, TodoItemType[]>();

  items.forEach((item) => {
    const parentId = item.parent_item_id;
    if (!tree.has(parentId)) {
      tree.set(parentId, []);
    }
    tree.get(parentId)!.push(item);
  });

  return tree;
}

// Get children for a specific item
function getChildren(itemId: string, tree: Map<string | null, TodoItemType[]>): TodoItemType[] {
  return tree.get(itemId) || [];
}

export default function TodoListDisplay({ todoItems, onToggle }: TodoListDisplayProps) {
  if (!todoItems || todoItems.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No to-do items found for this analysis.</p>
      </div>
    );
  }

  // Group items by category
  const categorized = todoItems.reduce((acc, item) => {
    const category = item.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, TodoItemType[]>);

  // Build tree structure for finding children
  const tree = buildTodoTree(todoItems);

  // Sort categories in logical order
  const categoryOrder = [
    'physical_examination', 'investigations', 'differential_diagnosis',
    'management_plan', 'complications', 'follow_up',
    // Legacy order
    'physical_exam', 'tests', 'differential', 'management',
    'diagnostic', 'treatment', 'follow-up', 'referral', 'monitoring', 'lifestyle',
    'uncategorized'
  ];
  const sortedCategories = Object.keys(categorized).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">To-Do List</h2>

      {sortedCategories.map((category) => {
        const items = categorized[category];
        // Only show root items (parent_item_id === null)
        const rootItems = items
          .filter((item) => item.parent_item_id === null)
          .sort((a, b) => a.item_order - b.item_order);

        if (rootItems.length === 0) return null;

        return (
          <div
            key={category}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            {/* Category header */}
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-1 h-6 bg-blue-600 rounded mr-3" />
              {CATEGORY_LABELS[category] || category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>

            {/* Todo items */}
            <div className="space-y-1">
              {rootItems.map((item) => (
                <TodoItem
                  key={item.id}
                  item={item}
                  children={getChildren(item.id, tree)}
                  onToggle={onToggle}
                  depth={0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
