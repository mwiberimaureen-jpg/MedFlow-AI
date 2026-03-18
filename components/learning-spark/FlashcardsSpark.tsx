'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { FlashcardContent } from '@/lib/types/learning-spark'

interface FlashcardsSparkProps {
  content: FlashcardContent
  onInteraction: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  pathophysiology: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  diagnosis: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  management: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  complications: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export function FlashcardsSpark({ content, onInteraction }: FlashcardsSparkProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Record<string, 'knew' | 'review'>>({})
  const [hasInteracted, setHasInteracted] = useState(false)

  const card = content.cards[currentIndex]
  const isComplete = Object.keys(results).length === content.cards.length

  const handleFlip = () => {
    setFlipped(true)
    if (!hasInteracted) {
      setHasInteracted(true)
      onInteraction()
    }
  }

  const handleResult = (result: 'knew' | 'review') => {
    setResults(prev => ({ ...prev, [card.id]: result }))
    setFlipped(false)

    // Move to next unanswered card
    const nextIndex = content.cards.findIndex((c, i) => i > currentIndex && !results[c.id])
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex)
    } else {
      // Check for any unanswered before current
      const before = content.cards.findIndex((c) => !results[c.id] && c.id !== card.id)
      if (before !== -1) setCurrentIndex(before)
    }
  }

  const knewCount = Object.values(results).filter(r => r === 'knew').length
  const reviewCount = Object.values(results).filter(r => r === 'review').length

  if (isComplete) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">All done!</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Topic: <span className="font-medium">{content.topic}</span>
          </p>
        </div>
        <div className="flex justify-center gap-4">
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{knewCount}</p>
            <p className="text-xs text-green-600 dark:text-green-400">Knew it</p>
          </div>
          <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{reviewCount}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400">Review later</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {content.cards.map((c, i) => (
          <div
            key={c.id}
            className={`w-2 h-2 rounded-full transition-colors ${
              results[c.id] === 'knew' ? 'bg-green-500' :
              results[c.id] === 'review' ? 'bg-orange-500' :
              i === currentIndex ? 'bg-blue-500' :
              'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {Object.keys(results).length}/{content.cards.length}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => !flipped && handleFlip()}
        className={`min-h-[160px] rounded-lg border-2 p-5 transition-all cursor-pointer ${
          flipped
            ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[card.category] || CATEGORY_COLORS.diagnosis}`}>
            {card.category}
          </span>
          {!flipped && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Tap to flip</span>
          )}
        </div>

        {!flipped ? (
          <p className="text-base font-medium text-gray-900 dark:text-white">{card.front}</p>
        ) : (
          <p className="text-sm text-gray-800 dark:text-gray-200">{card.back}</p>
        )}
      </div>

      {/* Action buttons (only when flipped) */}
      {flipped && (
        <div className="flex gap-2">
          <button
            onClick={() => handleResult('review')}
            className="flex-1 py-2.5 rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 transition-colors text-sm"
          >
            Review Later
          </button>
          <button
            onClick={() => handleResult('knew')}
            className="flex-1 py-2.5 rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 transition-colors text-sm"
          >
            Knew It!
          </button>
        </div>
      )}
    </div>
  )
}
