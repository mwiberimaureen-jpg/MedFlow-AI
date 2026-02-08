import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { TodoList } from './TodoList'
import { Analysis, TodoItem } from '@/lib/types/patient'

interface AnalysisPanelProps {
  analysis: Analysis & { todo_items: TodoItem[] }
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const getRiskBadge = (risk: string) => {
    const variants: Record<string, 'danger' | 'warning' | 'success'> = {
      high: 'danger',
      medium: 'warning',
      low: 'success'
    }
    return variants[risk] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <Card header={{
        title: 'Clinical Analysis',
        subtitle: `Generated on ${new Date(analysis.created_at).toLocaleDateString()}`
      }}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Risk Level:</span>
            <Badge variant={getRiskBadge(analysis.risk_level)}>
              {analysis.risk_level.toUpperCase()}
            </Badge>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Summary</h4>
            <div className="prose prose-sm max-w-none text-gray-700">
              {analysis.summary.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-2">{paragraph}</p>
              ))}
            </div>
          </div>

          {analysis.model_used && (
            <div className="pt-4 border-t border-gray-200 text-sm text-gray-500">
              <div className="flex items-center justify-between">
                <span>Model: {analysis.model_used}</span>
                {analysis.processing_time_ms && (
                  <span>Processing time: {(analysis.processing_time_ms / 1000).toFixed(2)}s</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Action Items */}
      <Card header={{
        title: 'Action Items',
        subtitle: `${analysis.total_items} total items`
      }}>
        <TodoList items={analysis.todo_items} />
      </Card>
    </div>
  )
}
