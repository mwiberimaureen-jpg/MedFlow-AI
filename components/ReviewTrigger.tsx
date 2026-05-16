'use client'

import { useState, useEffect } from 'react'
import { ReviewModal } from './ReviewModal'

const TRIAL_REVIEW_KEY = 'medflow_review_trial_done'
const TRIAL_REVIEW_THRESHOLD = 3

interface ReviewTriggerProps {
  userEmail: string
  userName?: string
}

export function ReviewTrigger({ userEmail, userName }: ReviewTriggerProps) {
  const [showTrialModal, setShowTrialModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const trialDone = localStorage.getItem(TRIAL_REVIEW_KEY) === 'true'
      if (trialDone) return

      try {
        const res = await fetch('/api/auth/trial-status')
        if (!res.ok || cancelled) return
        const quota = await res.json()
        if (cancelled) return

        const { used, subscribed, exempt } = quota
        if (exempt || subscribed) return

        if (used >= TRIAL_REVIEW_THRESHOLD) {
          setTimeout(() => {
            if (!cancelled) setShowTrialModal(true)
          }, 1500)
        }
      } catch { /* ignore */ }
    }

    check()
    return () => { cancelled = true }
  }, [])

  function handleClose() {
    // "Maybe Later" — suppress for this session only, will show again next visit
    setShowTrialModal(false)
  }

  function handleSubmitted() {
    // Submitted — no need to ask again during this trial
    localStorage.setItem(TRIAL_REVIEW_KEY, 'true')
    setShowTrialModal(false)
  }

  if (!showTrialModal) return null

  return (
    <ReviewModal
      userEmail={userEmail}
      userName={userName}
      context="trial"
      onClose={handleClose}
      onSubmitted={handleSubmitted}
    />
  )
}
