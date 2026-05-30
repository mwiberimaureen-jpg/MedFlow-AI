'use client'

import { Badge } from '@/components/ui/Badge'
import type { SparkFormat } from '@/lib/types/learning-spark'

const FORMAT_LABELS: Record<SparkFormat, { label: string; variant: 'info' | 'warning' | 'danger' | 'success' }> = {
  senior_asks: { label: 'The Senior Asks', variant: 'info' },
  quick_teach: { label: 'Quick Teach', variant: 'warning' },
  know_your_drugs: { label: 'Know Your Drugs', variant: 'success' },
  clinical_twist: { label: 'Clinical Twist', variant: 'danger' },
}

function getStreakColor(streak: number): string {
  if (streak >= 30) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
  if (streak >= 14) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
  if (streak >= 7)  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
  return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
}

interface SparkHeaderProps {
  format: SparkFormat
  streak: number
  longestStreak?: number
  topic?: string
}

export function SparkHeader({ format, streak, longestStreak, topic }: SparkHeaderProps) {
  const { label, variant } = FORMAT_LABELS[format] || { label: format, variant: 'info' as const }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Senior Peer Review
          </h3>
          <Badge variant={variant}>{label}</Badge>
        </div>

        {streak > 0 && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-sm ${getStreakColor(streak)}`}>
            <span>🔥</span>
            <span>{streak}</span>
            <span className="font-normal text-xs opacity-80">day{streak !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {topic && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{topic}</p>
      )}

      {streak >= 7 && longestStreak && longestStreak > streak && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Personal best: {longestStreak} days
        </p>
      )}
    </div>
  )
}
