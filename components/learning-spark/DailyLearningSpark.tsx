'use client'

import { useEffect, useState, useCallback } from 'react'
import { SparkHeader } from './SparkHeader'
import { SeniorAsksSpark } from './SeniorAsksSpark'
import { QuickTeachSpark } from './QuickTeachSpark'
import { KnowYourDrugsSpark } from './KnowYourDrugsSpark'
import { ClinicalTwistSpark } from './ClinicalTwistSpark'
import type {
  DailyLearningSpark as SparkType,
  LearningSparkState,
  SeniorAsksContent,
  QuickTeachContent,
  KnowYourDrugsContent,
  ClinicalTwistContent,
} from '@/lib/types/learning-spark'
import { getDefaultSparkState } from '@/lib/types/learning-spark'

const STORAGE_KEY = 'medflow_learning_spark_state'

function loadState(): LearningSparkState {
  if (typeof window === 'undefined') return getDefaultSparkState()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultSparkState()
  } catch {
    return getDefaultSparkState()
  }
}

function saveState(state: LearningSparkState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function calculateStreak(state: LearningSparkState, todayISO: string, sparkId: string): LearningSparkState {
  if (state.seenSparks.includes(sparkId)) return state

  if (!state.lastInteractionDate) {
    return {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(1, state.longestStreak),
      lastInteractionDate: todayISO,
      seenSparks: [...state.seenSparks, sparkId],
    }
  }

  const today = new Date(todayISO)
  const last = new Date(state.lastInteractionDate)
  const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000)

  if (diffDays === 0) {
    return { ...state, seenSparks: [...state.seenSparks, sparkId] }
  }

  const newStreak = diffDays === 1 ? state.currentStreak + 1 : 1
  return {
    ...state,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, state.longestStreak),
    lastInteractionDate: todayISO,
    seenSparks: [...state.seenSparks, sparkId],
  }
}

export function DailyLearningSpark() {
  const [spark, setSpark] = useState<SparkType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<LearningSparkState>(getDefaultSparkState)

  useEffect(() => {
    setState(loadState())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchSpark() {
      try {
        const res = await fetch('/api/learning-spark/today')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.message || data?.error || `API error ${res.status}`)
        }

        if (!cancelled && data.spark) {
          setSpark(data.spark)
        }
      } catch (err: any) {
        console.error('Senior Peer Review error:', err)
        if (!cancelled) setError(err.message || 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSpark()
    return () => { cancelled = true }
  }, [])

  const handleInteraction = useCallback(() => {
    if (!spark) return
    const today = new Date().toISOString().split('T')[0]
    const newState = calculateStreak(state, today, spark.id)
    setState(newState)
    saveState(newState)
  }, [spark, state])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Senior Peer Review
        </h3>
        <p className="text-sm text-red-500 dark:text-red-400 text-center py-4">
          Failed to load: {error}
        </p>
      </div>
    )
  }

  if (!spark) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Senior Peer Review
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          Complete a patient analysis to unlock today&apos;s discussion!
        </p>
      </div>
    )
  }

  const topic = (spark.content as any)?.topic

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <SparkHeader
        format={spark.format_type}
        streak={state.currentStreak}
        topic={topic}
      />

      <div className="mt-4">
        {spark.format_type === 'senior_asks' && (
          <SeniorAsksSpark content={spark.content as SeniorAsksContent} onInteraction={handleInteraction} />
        )}
        {spark.format_type === 'quick_teach' && (
          <QuickTeachSpark content={spark.content as QuickTeachContent} onInteraction={handleInteraction} />
        )}
        {spark.format_type === 'know_your_drugs' && (
          <KnowYourDrugsSpark content={spark.content as KnowYourDrugsContent} onInteraction={handleInteraction} />
        )}
        {spark.format_type === 'clinical_twist' && (
          <ClinicalTwistSpark content={spark.content as ClinicalTwistContent} onInteraction={handleInteraction} />
        )}
      </div>
    </div>
  )
}
