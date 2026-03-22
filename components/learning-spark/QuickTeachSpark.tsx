'use client'

import { useState } from 'react'
import { StarButton } from './StarButton'
import type { QuickTeachContent } from '@/lib/types/learning-spark'

interface QuickTeachSparkProps {
  content: QuickTeachContent
  onInteraction: () => void
  onStar: () => void
  isStarred: boolean
  starSaving: boolean
}

const TYPE_LABELS: Record<string, string> = {
  classification: 'Classification',
  mnemonic: 'Mnemonic',
  pathophysiology: 'Pathophysiology',
  criteria: 'Criteria',
}

const TYPE_COLORS: Record<string, string> = {
  classification: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  mnemonic: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pathophysiology: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  criteria: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export function QuickTeachSpark({ content, onInteraction, onStar, isStarred, starSaving }: QuickTeachSparkProps) {
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleRevealCard = (id: string) => {
    setRevealedCards(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    if (!hasInteracted) {
      setHasInteracted(true)
      onInteraction()
    }
  }

  const allRevealed = content.cards.every(c => revealedCards.has(c.id))

  return (
    <div className="space-y-4">
      {/* Intro + type badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">{content.intro}</p>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_COLORS[content.teach_type] || TYPE_COLORS.classification}`}>
          {TYPE_LABELS[content.teach_type] || content.teach_type}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {content.cards.map((card) => {
          const isRevealed = revealedCards.has(card.id)
          return (
            <div
              key={card.id}
              onClick={() => !isRevealed && handleRevealCard(card.id)}
              className={`rounded-lg border-2 p-3 transition-all ${
                isRevealed
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{card.title}</p>
                {!isRevealed && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Tap to reveal</span>
                )}
              </div>
              {isRevealed && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{card.content}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary pearl — shown when all cards revealed */}
      {allRevealed && (
        <>
          <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
            <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Key Takeaway</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">{content.summary_pearl}</p>
          </div>

          <div className="flex justify-end">
            <StarButton isStarred={isStarred} saving={starSaving} onClick={onStar} />
          </div>
        </>
      )}
    </div>
  )
}
