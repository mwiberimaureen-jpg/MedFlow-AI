'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { QuizContent } from '@/lib/types/learning-spark'

interface QuizSparkProps {
  content: QuizContent
  onInteraction: () => void
}

export function QuizSpark({ content, onInteraction }: QuizSparkProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const handleSelect = (index: number) => {
    if (!revealed) setSelectedIndex(index)
  }

  const handleReveal = () => {
    setRevealed(true)
    onInteraction()
  }

  const isCorrect = selectedIndex === content.correct_index

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <p className="text-base font-medium text-gray-900 dark:text-white">{content.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {content.options.map((option, index) => {
          let borderClass = 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'

          if (selectedIndex === index && !revealed) {
            borderClass = 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          } else if (revealed && index === content.correct_index) {
            borderClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
          } else if (revealed && selectedIndex === index) {
            borderClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
          }

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={revealed}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all disabled:cursor-default ${borderClass}`}
            >
              <span className="text-sm text-gray-900 dark:text-white">
                <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </span>
            </button>
          )
        })}
      </div>

      {/* Reveal button */}
      {!revealed && selectedIndex !== null && (
        <button
          onClick={handleReveal}
          className="w-full py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Reveal Answer
        </button>
      )}

      {/* Result */}
      {revealed && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Badge variant={isCorrect ? 'success' : 'danger'}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </Badge>

          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Explanation</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{content.explanation}</p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Clinical Pearl</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">{content.clinical_pearl}</p>
          </div>
        </div>
      )}
    </div>
  )
}
