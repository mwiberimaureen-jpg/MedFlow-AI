import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { TodoList } from './TodoList'
import { Analysis, TodoItem } from '@/lib/types/patient'
import { parseAnalysisText } from '@/lib/utils/parse-analysis'

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

  const sections = parseAnalysisText(analysis.raw_analysis_text)

  const sectionIcons: Record<string, string> = {
    'Clinical Summary': '📋',
    'Gaps in History': '🔍',
    'Test Interpretation': '🧪',
    'Impression(s)': '🎯',
    'Differential Diagnoses': '🔀',
    'Confirmatory Tests': '✅',
    'Management Plan': '💊',
    'Possible Complications & Prevention': '⚠️',
  }

  const getSectionIcon = (title: string) => {
    for (const [key, icon] of Object.entries(sectionIcons)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon
    }
    return '📄'
  }

  return (
    <div className="space-y-6">
      {/* Header with risk level */}
      <Card header={{
        title: 'Clinical Analysis Report',
        subtitle: `Generated on ${new Date(analysis.created_at).toLocaleDateString()}`
      }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-gray-600">Risk Level:</span>
          <Badge variant={getRiskBadge(analysis.risk_level)}>
            {analysis.risk_level?.toUpperCase()}
          </Badge>
        </div>

        {analysis.model_used && (
          <div className="text-sm text-gray-500">
            <div className="flex items-center justify-between">
              <span>Model: {analysis.model_used}</span>
              {analysis.processing_time_ms && (
                <span>Processing time: {(analysis.processing_time_ms / 1000).toFixed(2)}s</span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Analysis Sections */}
      {sections.map((section) => (
        <Card key={section.order}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>{getSectionIcon(section.title)}</span>
            {section.title}
          </h3>
          <div
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: formatSectionContent(section.content)
            }}
          />
        </Card>
      ))}

      {/* Action Items */}
      {analysis.todo_items && analysis.todo_items.length > 0 && (
        <Card header={{
          title: 'Action Items Checklist',
          subtitle: `${analysis.total_items} items`
        }}>
          <TodoList items={analysis.todo_items} />
        </Card>
      )}
    </div>
  )
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
