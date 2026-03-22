'use client'

import { useState } from 'react'
import { StarButton } from './StarButton'
import type { SeniorAsksContent } from '@/lib/types/learning-spark'

interface SeniorAsksSparkProps {
  content: SeniorAsksContent
  onInteraction: () => void
  onStar: () => void
  isStarred: boolean
  starSaving: boolean
}

export function SeniorAsksSpark({ content, onInteraction, onStar, isStarred, starSaving }: SeniorAsksSparkProps) {
  const [revealed, setRevealed] = useState(false)

  const handleReveal = () => {
    setRevealed(true)
    onInteraction()
  }

  return (
    <div className="space-y-4">
      {/* Context */}
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">{content.context}</p>

      {/* The question */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">The Senior Asks</p>
        <p className="text-base font-medium text-gray-900 dark:text-white">{content.question}</p>
      </div>

      {/* Reveal button */}
      {!revealed && (
        <button
          onClick={handleReveal}
          className="w-full py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm"
        >
          Show Answer
        </button>
      )}

      {/* Answer */}
      {revealed && (
        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-800 dark:text-gray-200">{content.answer}</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/15 rounded-lg p-3 border border-amber-200 dark:border-amber-800/50">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Teaching Point</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{content.teaching_point}</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
            <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Clinical Pearl</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">{content.clinical_pearl}</p>
          </div>

          <div className="flex justify-end">
            <StarButton isStarred={isStarred} saving={starSaving} onClick={onStar} />
          </div>
        </div>
      )}
    </div>
  )
}
