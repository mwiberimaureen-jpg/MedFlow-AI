'use client'

import { useEffect, useState } from 'react'
import { getDefaultSparkState } from '@/lib/types/learning-spark'

const STORAGE_KEY = 'medflow_learning_spark_state'

function loadStreakFromStorage() {
  if (typeof window === 'undefined') return getDefaultSparkState()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultSparkState()
  } catch {
    return getDefaultSparkState()
  }
}

function getMotivationalMessage(streak: number): string {
  if (streak === 0) return 'Read today\'s spark to start your streak.'
  if (streak === 1) return 'Day 1 — every streak starts here. Come back tomorrow.'
  if (streak < 3)  return `${streak} days in a row. Keep the momentum going.`
  if (streak < 7)  return `${streak} days straight. You\'re building a real habit.`
  if (streak < 14) return `${streak} days. Clinical knowledge is compounding daily.`
  if (streak < 30) return `${streak} days! This is what consistent growth looks like.`
  if (streak < 60) return `${streak} days. You\'re in elite territory now.`
  return `${streak} days. Absolute dedication. Your patients benefit from this.`
}

export function StreakCard() {
  const [streak, setStreak] = useState(0)
  const [longest, setLongest] = useState(0)

  useEffect(() => {
    const state = loadStreakFromStorage()
    setStreak(state.currentStreak)
    setLongest(state.longestStreak)

    // DailyLearningSpark is the authoritative streak source — listen for its updates
    const handleStreakUpdate = (e: Event) => {
      const { currentStreak, longestStreak } = (e as CustomEvent).detail
      setStreak(currentStreak)
      setLongest(longestStreak)
    }
    window.addEventListener('medflow:streak-updated', handleStreakUpdate)
    return () => window.removeEventListener('medflow:streak-updated', handleStreakUpdate)
  }, [])

  const flameSize = streak >= 30 ? 'text-4xl' : streak >= 7 ? 'text-3xl' : 'text-2xl'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex items-center gap-5">
      <div className={`${flameSize} select-none`}>🔥</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">
            {streak}
          </span>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            day{streak !== 1 ? 's' : ''} streak
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
          {getMotivationalMessage(streak)}
        </p>
      </div>

      {longest > 0 && (
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Best</p>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{longest}</p>
        </div>
      )}
    </div>
  )
}
