'use client'

import { useState } from 'react'
import { StarButton } from './StarButton'
import type { ClinicalTwistContent } from '@/lib/types/learning-spark'

interface ClinicalTwistSparkProps {
  content: ClinicalTwistContent
  onInteraction: () => void
  onStar: () => void
  isStarred: boolean
  starSaving: boolean
}

export function ClinicalTwistSpark({ content, onInteraction, onStar, isStarred, starSaving }: ClinicalTwistSparkProps) {
  const [stage, setStage] = useState<'scenario' | 'twist' | 'revealed'>('scenario')

  const handleShowTwist = () => {
    setStage('twist')
    onInteraction()
  }

  const handleReveal = () => {
    setStage('revealed')
  }

  return (
    <div className="space-y-4">
      {/* Current scenario */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Current Scenario</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{content.scenario}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2"><span className="font-medium">Current plan:</span> {content.original_plan}</p>
      </div>

      {/* Show twist button */}
      {stage === 'scenario' && (
        <button
          onClick={handleShowTwist}
          className="w-full py-2.5 rounded-lg font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm"
        >
          What Changes If...
        </button>
      )}

      {/* The twist */}
      {(stage === 'twist' || stage === 'revealed') && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border-l-4 border-orange-500">
          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">The Twist</p>
          <p className="text-base font-medium text-gray-900 dark:text-white">{content.twist}</p>
        </div>
      )}

      {/* Reveal button */}
      {stage === 'twist' && (
        <button
          onClick={handleReveal}
          className="w-full py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm"
        >
          How Does the Plan Change?
        </button>
      )}

      {/* Revealed answer */}
      {stage === 'revealed' && (
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/15 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Revised Plan</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{content.revised_plan}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Reasoning</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{content.reasoning}</p>
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
