'use client'

import { useEffect, useState, useCallback } from 'react'
import { SparkHeader } from './SparkHeader'
import { StarButton } from './StarButton'
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
const SPARK_READ_KEY = 'medflow_spark_read'

const MILESTONES = [3, 7, 14, 21, 30, 60, 100]

function getMilestoneMessage(streak: number): string | null {
  const messages: Record<number, string> = {
    3:   "3 days in a row — you're building something real.",
    7:   "One week straight. The habit is forming.",
    14:  "Two weeks! This is becoming second nature.",
    21:  "21 days. Clinical knowledge is compounding.",
    30:  "One month of daily learning. That's elite.",
    60:  "60 days. You're in a different league now.",
    100: "100 days. Absolute legend.",
  }
  return messages[streak] ?? null
}

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
  // Same-day guard — only count once per calendar day no matter how many interactions occur
  if (state.lastInteractionDate === todayISO) return state

  // Don't track temp IDs — they indicate a failed DB insert and would cause refresh loops
  const trackableId = sparkId === 'temp' ? null : sparkId
  if (trackableId && state.seenSparks.includes(trackableId)) return state

  const newSeenSparks = trackableId
    ? [...state.seenSparks, trackableId]
    : state.seenSparks

  if (!state.lastInteractionDate) {
    return {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(1, state.longestStreak),
      lastInteractionDate: todayISO,
      seenSparks: newSeenSparks,
    }
  }

  const today = new Date(todayISO)
  const last = new Date(state.lastInteractionDate)
  const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000)

  if (diffDays === 0) {
    return { ...state, seenSparks: newSeenSparks }
  }

  const newStreak = diffDays === 1 ? state.currentStreak + 1 : 1
  return {
    ...state,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, state.longestStreak),
    lastInteractionDate: todayISO,
    seenSparks: newSeenSparks,
  }
}

function formatSparkAsNote(spark: SparkType): { title: string; content: string } {
  const c = spark.content as any
  const topic = c.topic || 'Clinical Note'
  return {
    title: topic,
    content: JSON.stringify({ _sparkFormat: spark.format_type, ...c }),
  }
}

export function DailyLearningSpark() {
  const [spark, setSpark] = useState<SparkType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<LearningSparkState>(getDefaultSparkState)
  const [starSaving, setStarSaving] = useState(false)
  const [showRotationPicker, setShowRotationPicker] = useState(false)
  const [selectedRotation, setSelectedRotation] = useState('')
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null)

  useEffect(() => {
    const local = loadState()
    setState(local)
    setSelectedRotation(getLastRotation())

    // Load streak from DB — take the higher streak count, but never overwrite
    // a more recent lastInteractionDate with an older one from the DB.
    fetch('/api/learning-spark/streak')
      .then(r => r.json())
      .then(({ currentStreak, longestStreak, lastSparkDate }) => {
        if (currentStreak !== null) {
          // Re-read localStorage now (not the `local` captured at mount) —
          // handleInteraction may have already updated it while this fetch
          // was in flight. Merging against the stale `local` would revert
          // today's streak increment, making it look like the app "forgot"
          // which day the streak is on.
          const fresh = loadState()
          const localDate = fresh.lastInteractionDate ?? ''
          const dbDate = lastSparkDate ?? ''
          const mergedLastDate = dbDate > localDate ? dbDate : (localDate || undefined)

          const merged: LearningSparkState = {
            ...fresh,
            currentStreak: Math.max(fresh.currentStreak, currentStreak),
            longestStreak: Math.max(fresh.longestStreak, longestStreak ?? 0),
            lastInteractionDate: mergedLastDate ?? fresh.lastInteractionDate,
          }
          setState(merged)
          saveState(merged)
          window.dispatchEvent(new CustomEvent('medflow:streak-updated', {
            detail: { currentStreak: merged.currentStreak, longestStreak: merged.longestStreak }
          }))
        }
      })
      .catch(() => { /* fall back to localStorage silently */ })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchSpark() {
      try {
        // Step 1: Check the explicit read flag first
        const sparkReadFlag = localStorage.getItem(SPARK_READ_KEY) === 'true'
        if (sparkReadFlag) {
          localStorage.removeItem(SPARK_READ_KEY)
        }

        // Step 2: Fetch cached spark (or generate if none exists)
        const firstUrl = sparkReadFlag
          ? '/api/learning-spark/today?refresh=true'
          : '/api/learning-spark/today'

        const res = await fetch(firstUrl)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.message || data?.error || `API error ${res.status}`)
        }

        if (!cancelled && data.spark) {
          // Step 3: Only check seenSparks for real (non-temp) spark IDs.
          // 'temp' means the DB insert failed (schema constraint), so don't
          // treat it as "seen" — that causes an infinite refresh loop.
          const currentState = loadState()
          const isRealId = data.spark.id && data.spark.id !== 'temp'
          if (!sparkReadFlag && isRealId && currentState.seenSparks.includes(data.spark.id)) {
            // User already read this spark — fetch a fresh one
            const refreshRes = await fetch('/api/learning-spark/today?refresh=true')
            const refreshData = await refreshRes.json()
            if (!cancelled && refreshData.spark) {
              setSpark(refreshData.spark)
              return
            }
          }
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

  const isStarred = !!(spark && state.starredSparks?.includes(spark.id))

  const handleInteraction = useCallback(() => {
    if (!spark) return
    // Use LOCAL date (not UTC) so the streak advances at local midnight,
    // not at UTC midnight (which would be 3am in Nairobi for UTC+3 users).
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const prev = state.currentStreak
    const newState = calculateStreak(state, today, spark.id)
    setState(newState)
    saveState(newState)
    window.dispatchEvent(new CustomEvent('medflow:streak-updated', {
      detail: { currentStreak: newState.currentStreak, longestStreak: newState.longestStreak }
    }))
    try { localStorage.setItem(SPARK_READ_KEY, 'true') } catch { /* ignore */ }

    // Show milestone message if streak just hit a milestone
    if (newState.currentStreak !== prev && MILESTONES.includes(newState.currentStreak)) {
      setMilestoneMessage(getMilestoneMessage(newState.currentStreak))
    }

    // Sync to DB (fire-and-forget)
    fetch('/api/learning-spark/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentStreak: newState.currentStreak,
        longestStreak: newState.longestStreak,
        lastSparkDate: today,
      }),
    }).catch(() => { /* silent — localStorage is the fallback */ })
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

      const newState = {
        ...state,
        starredSparks: [...(state.starredSparks || []), spark.id],
      }
      setState(newState)
      saveState(newState)
      if (selectedRotation) saveLastRotation(selectedRotation)
    } catch (err) {
      console.error('Failed to star spark:', err)
    } finally {
      setStarSaving(false)
    }
  }, [spark, isStarred, starSaving, selectedRotation, state])

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
        longestStreak={state.longestStreak}
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

      {/* Milestone celebration banner */}
      {milestoneMessage && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <span className="text-xl">🔥</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
              {state.currentStreak}-day streak!
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400">{milestoneMessage}</p>
          </div>
          <button
            onClick={() => setMilestoneMessage(null)}
            className="text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Star button — always visible so users can save any spark */}
      <div className="flex justify-end mt-3">
        <StarButton isStarred={isStarred} saving={starSaving} onClick={handleStarClick} />
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
