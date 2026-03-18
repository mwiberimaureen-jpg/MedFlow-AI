'use client'

import { useState } from 'react'
import type { MythContent } from '@/lib/types/learning-spark'

interface MythBusterSparkProps {
  content: MythContent
  onInteraction: () => void
}

export function MythBusterSpark({ content, onInteraction }: MythBusterSparkProps) {
  const [stage, setStage] = useState<'myth' | 'reality' | 'why'>('myth')

  const handleNext = () => {
    if (stage === 'myth') {
      setStage('reality')
      onInteraction()
    } else if (stage === 'reality') {
      setStage('why')
    }
  }

  return (
    <div className="space-y-4">
      {/* Myth - always visible */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Myth</p>
        <p className="text-base text-gray-900 dark:text-white font-medium">&ldquo;{content.myth}&rdquo;</p>
        {stage === 'myth' && content.clinical_context && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{content.clinical_context}</p>
        )}
      </div>

      {/* Reality - revealed on tap */}
      {(stage === 'reality' || stage === 'why') && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 animate-fadeIn">
          <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Reality</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{content.reality}</p>
        </div>
      )}

      {/* Why it matters - final reveal */}
      {stage === 'why' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 animate-fadeIn">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Why It Matters</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{content.why_it_matters}</p>
        </div>
      )}

      {/* Next button */}
      {stage !== 'why' && (
        <button
          onClick={handleNext}
          className="w-full py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
        >
          {stage === 'myth' ? 'Bust This Myth' : 'Why Does This Matter?'}
        </button>
      )}
    </div>
  )
}
