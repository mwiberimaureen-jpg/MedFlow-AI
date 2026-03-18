'use client'

import { Badge } from '@/components/ui/Badge'
import type { SparkFormat } from '@/lib/types/learning-spark'

const FORMAT_LABELS: Record<SparkFormat, { label: string; variant: 'info' | 'warning' | 'danger' | 'success' }> = {
  quiz: { label: 'Quiz', variant: 'info' },
  mystery: { label: 'Mystery Case', variant: 'warning' },
  myth: { label: 'Myth Buster', variant: 'danger' },
  flashcards: { label: 'Flashcards', variant: 'success' },
}

interface SparkHeaderProps {
  format: SparkFormat
  streak: number
  topic?: string
}

export function SparkHeader({ format, streak, topic }: SparkHeaderProps) {
  const { label, variant } = FORMAT_LABELS[format]

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Daily Learning Spark
        </h3>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full">
            <span className="text-orange-600 dark:text-orange-400 text-sm font-bold">
              {streak}
            </span>
            <span className="text-xs text-orange-500 dark:text-orange-400">
              day{streak !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {topic && (
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
            {topic}
          </span>
        )}
      </div>
    </div>
  )
}
