'use client'

import { useEffect, useState, useCallback } from 'react'
import { SparkHeader } from './SparkHeader'
import { SeniorAsksSpark } from './SeniorAsksSpark'
import { QuickTeachSpark } from './QuickTeachSpark'
import { KnowYourDrugsSpark } from './KnowYourDrugsSpark'
import { ClinicalTwistSpark } from './ClinicalTwistSpark'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'
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
const LAST_ROTATION_KEY = 'medflow_last_star_rotation'

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

function getLastRotation(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(LAST_ROTATION_KEY) || ''
}

function saveLastRotation(rotation: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_ROTATION_KEY, rotation)
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

function formatSparkAsNote(spark: SparkType): { title: string; content: string } {
  const c = spark.content as any
  const topic = c.topic || 'Clinical Note'

  switch (spark.format_type) {
    case 'senior_asks':
      return {
        title: topic,
        content: `Q: ${c.question}\n\nA: ${c.answer}\n\nTeaching Point: ${c.teaching_point}\n\nClinical Pearl: ${c.clinical_pearl}`,
      }
    case 'quick_teach':
      return {
        title: topic,
        content: `${c.intro}\n\n${c.cards.map((card: any) => `${card.title}: ${card.content}`).join('\n\n')}\n\nKey Takeaway: ${c.summary_pearl}`,
      }
    case 'know_your_drugs':
      return {
        title: topic,
        content: `${c.context}\n\n${c.drugs.map((d: any) => `${d.name}\n  Mechanism: ${d.mechanism}\n  When to use: ${d.when_to_use}\n  Key point: ${d.key_point}`).join('\n\n')}\n\nClinical Pearl: ${c.clinical_pearl}`,
      }
    case 'clinical_twist':
      return {
        title: topic,
        content: `Scenario: ${c.scenario}\n\nOriginal Plan: ${c.original_plan}\n\nTwist: ${c.twist}\n\nRevised Plan: ${c.revised_plan}\n\nReasoning: ${c.reasoning}\n\nClinical Pearl: ${c.clinical_pearl}`,
      }
    default:
      return { title: topic, content: JSON.stringify(c, null, 2) }
  }
}

export function DailyLearningSpark() {
  const [spark, setSpark] = useState<SparkType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<LearningSparkState>(getDefaultSparkState)
  const [isStarred, setIsStarred] = useState(false)
  const [starSaving, setStarSaving] = useState(false)
  const [showRotationPicker, setShowRotationPicker] = useState(false)
  const [selectedRotation, setSelectedRotation] = useState('')

  useEffect(() => {
    setState(loadState())
    setSelectedRotation(getLastRotation())
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

  // Check if current spark is already starred
  useEffect(() => {
    if (!spark) return
    let cancelled = false

    async function checkStarred() {
      try {
        const res = await fetch('/api/notes')
        const data = await res.json()
        if (!cancelled && data.notes) {
          const found = data.notes.some((n: any) => n.spark_id === spark!.id)
          setIsStarred(found)
        }
      } catch { /* ignore */ }
    }

    checkStarred()
    return () => { cancelled = true }
  }, [spark])

  const handleInteraction = useCallback(() => {
    if (!spark) return
    const today = new Date().toISOString().split('T')[0]
    const newState = calculateStreak(state, today, spark.id)
    setState(newState)
    saveState(newState)
  }, [spark, state])

  const handleStarClick = useCallback(() => {
    if (!spark || isStarred || starSaving) return
    setShowRotationPicker(true)
  }, [spark, isStarred, starSaving])

  const handleConfirmStar = useCallback(async () => {
    if (!spark || isStarred || starSaving) return
    setStarSaving(true)
    setShowRotationPicker(false)

    try {
      const { title, content } = formatSparkAsNote(spark)
      const rotation = selectedRotation || null

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          source: spark.format_type,
          spark_id: spark.id,
          rotation,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')
      setIsStarred(true)
      if (selectedRotation) saveLastRotation(selectedRotation)
    } catch (err) {
      console.error('Failed to star spark:', err)
    } finally {
      setStarSaving(false)
    }
  }, [spark, isStarred, starSaving, selectedRotation])

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
          <SeniorAsksSpark content={spark.content as SeniorAsksContent} onInteraction={handleInteraction} onStar={handleStarClick} isStarred={isStarred} starSaving={starSaving} />
        )}
        {spark.format_type === 'quick_teach' && (
          <QuickTeachSpark content={spark.content as QuickTeachContent} onInteraction={handleInteraction} onStar={handleStarClick} isStarred={isStarred} starSaving={starSaving} />
        )}
        {spark.format_type === 'know_your_drugs' && (
          <KnowYourDrugsSpark content={spark.content as KnowYourDrugsContent} onInteraction={handleInteraction} onStar={handleStarClick} isStarred={isStarred} starSaving={starSaving} />
        )}
        {spark.format_type === 'clinical_twist' && (
          <ClinicalTwistSpark content={spark.content as ClinicalTwistContent} onInteraction={handleInteraction} onStar={handleStarClick} isStarred={isStarred} starSaving={starSaving} />
        )}
      </div>

      {/* Rotation picker modal */}
      {showRotationPicker && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Save to rotation:</p>
          <select
            value={selectedRotation}
            onChange={e => setSelectedRotation(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
          >
            <option value="">No rotation</option>
            {DEFAULT_ROTATIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRotationPicker(false)}
              className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmStar}
              className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
