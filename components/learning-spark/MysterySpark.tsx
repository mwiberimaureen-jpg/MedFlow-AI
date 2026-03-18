'use client'

import { useState } from 'react'
import type { MysteryContent } from '@/lib/types/learning-spark'

interface MysterySparkProps {
  content: MysteryContent
  onInteraction: () => void
}

export function MysterySpark({ content, onInteraction }: MysterySparkProps) {
  const [revealedClues, setRevealedClues] = useState(0)
  const [solved, setSolved] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleRevealClue = () => {
    if (revealedClues < content.clues.length) {
      setRevealedClues(prev => prev + 1)
      if (!hasInteracted) {
        setHasInteracted(true)
        onInteraction()
      }
    }
  }

  const handleSolve = () => {
    setSolved(true)
    if (!hasInteracted) {
      setHasInteracted(true)
      onInteraction()
    }
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
        <p className="text-base font-bold text-gray-900 dark:text-white">{content.title}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{content.patient_presentation}</p>
      </div>

      {/* Clues */}
      <div className="space-y-2">
        {content.clues.map((clue, index) => (
          <div
            key={clue.order}
            className={`p-3 rounded-lg border transition-all ${
              index < revealedClues
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                index < revealedClues
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                Clue {clue.order}
              </span>
              {index < revealedClues ? (
                <p className="text-sm text-gray-800 dark:text-gray-200">{clue.clue}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Hidden</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {revealedClues < content.clues.length && (
          <button
            onClick={handleRevealClue}
            className="flex-1 py-2.5 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm"
          >
            Reveal Clue {revealedClues + 1}
          </button>
        )}
        {!solved && (
          <button
            onClick={handleSolve}
            className="flex-1 py-2.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors text-sm"
          >
            Show Diagnosis
          </button>
        )}
      </div>

      {/* Diagnosis reveal */}
      {solved && (
        <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div>
            <p className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-wide">Diagnosis</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">{content.diagnosis}</p>
          </div>

          <div className="border-t border-green-200 dark:border-green-800 pt-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Key Pearls</p>
            <ul className="space-y-1">
              {content.key_pearls.map((pearl, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#x2022;</span>
                  {pearl}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
