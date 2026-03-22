'use client'

import { useState } from 'react'
import { StarButton } from './StarButton'
import type { KnowYourDrugsContent } from '@/lib/types/learning-spark'

interface KnowYourDrugsSparkProps {
  content: KnowYourDrugsContent
  onInteraction: () => void
  onStar: () => void
  isStarred: boolean
  starSaving: boolean
}

export function KnowYourDrugsSpark({ content, onInteraction, onStar, isStarred, starSaving }: KnowYourDrugsSparkProps) {
  const [expandedDrug, setExpandedDrug] = useState<number | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showPearl, setShowPearl] = useState(false)

  const handleExpand = (index: number) => {
    setExpandedDrug(expandedDrug === index ? null : index)
    if (!hasInteracted) {
      setHasInteracted(true)
      onInteraction()
    }
  }

  return (
    <div className="space-y-4">
      {/* Context */}
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">{content.context}</p>

      {/* Drug cards */}
      <div className="space-y-2">
        {content.drugs.map((drug, index) => {
          const isExpanded = expandedDrug === index
          return (
            <div
              key={index}
              onClick={() => handleExpand(index)}
              className={`rounded-lg border-2 p-3 transition-all cursor-pointer ${
                isExpanded
                  ? 'border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 dark:hover:border-teal-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{drug.name}</p>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Mechanism: </span>
                    <span className="text-gray-800 dark:text-gray-200">{drug.mechanism}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">When to use: </span>
                    <span className="text-gray-800 dark:text-gray-200">{drug.when_to_use}</span>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/15 rounded p-2 border border-amber-200 dark:border-amber-800/50">
                    <span className="font-medium text-amber-700 dark:text-amber-400">Key point: </span>
                    <span className="text-gray-800 dark:text-gray-200">{drug.key_point}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Show pearl button */}
      {!showPearl && (
        <button
          onClick={() => { setShowPearl(true); if (!hasInteracted) { setHasInteracted(true); onInteraction() } }}
          className="w-full py-2.5 rounded-lg font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors text-sm"
        >
          Show Clinical Pearl
        </button>
      )}

      {/* Clinical pearl */}
      {showPearl && (
        <>
          <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
            <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Clinical Pearl</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">{content.clinical_pearl}</p>
          </div>

          <div className="flex justify-end">
            <StarButton isStarred={isStarred} saving={starSaving} onClick={onStar} />
          </div>
        </>
      )}
    </div>
  )
}
