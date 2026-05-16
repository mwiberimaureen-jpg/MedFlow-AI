'use client'

import { useState, useEffect } from 'react'
import { ReviewModal } from './ReviewModal'
import { ReviewBanner } from './ReviewBanner'

const TRIAL_REVIEW_KEY = 'medflow_review_trial_done'
const PAID_REVIEW_KEY = 'medflow_review_paid_dismissed'
// Show trial modal after this many analyses
const TRIAL_REVIEW_THRESHOLD = 3
// Show paid banner after this many analyses as a subscriber
const PAID_REVIEW_THRESHOLD = 3

interface ReviewTriggerProps {
  userEmail: string
  userName?: string
}

export function ReviewTrigger({ userEmail, userName }: ReviewTriggerProps) {
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showPaidModal, setShowPaidModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      // Don't show anything if already done
      const trialDone = localStorage.getItem(TRIAL_REVIEW_KEY) === 'true'
      const paidDismissed = localStorage.getItem(PAID_REVIEW_KEY) === 'true'

      if (trialDone && paidDismissed) return

      try {
        const res = await fetch('/api/auth/trial-status')
        if (!res.ok || cancelled) return
        const quota = await res.json()

        if (cancelled) return

        const { used, subscribed, exempt } = quota
        if (exempt) return

        if (subscribed) {
          // Paid user: show banner after 3 analyses, once only
          if (!paidDismissed && used >= PAID_REVIEW_THRESHOLD) {
            setShowBanner(true)
          }
        } else {
          // Trial user: show modal after 3rd analysis, once only
          if (!trialDone && used >= TRIAL_REVIEW_THRESHOLD) {
            // Small delay so the page finishes loading before the modal appears
            setTimeout(() => {
              if (!cancelled) setShowTrialModal(true)
            }, 1500)
          }
        }
      } catch { /* ignore network errors */ }
    }

    check()
    return () => { cancelled = true }
  }, [])

  function handleTrialClose() {
    setShowTrialModal(false)
    // "Maybe Later" — only suppress for this session, not permanently
  }

  function handleTrialSubmitted() {
    localStorage.setItem(TRIAL_REVIEW_KEY, 'true')
    setShowTrialModal(false)
  }

  function handleBannerDismiss() {
    localStorage.setItem(PAID_REVIEW_KEY, 'true')
    setShowBanner(false)
  }

  function handleBannerLeaveReview() {
    setShowBanner(false)
    setShowPaidModal(true)
  }

  function handlePaidModalClose() {
    setShowPaidModal(false)
    // "Maybe Later" on paid modal — show banner again next session
  }

  function handlePaidSubmitted() {
    localStorage.setItem(PAID_REVIEW_KEY, 'true')
    setShowPaidModal(false)
  }

  return (
    <>
      {showTrialModal && (
        <ReviewModal
          userEmail={userEmail}
          userName={userName}
          context="trial"
          onClose={handleTrialClose}
          onSubmitted={handleTrialSubmitted}
        />
      )}
      {showBanner && (
        <ReviewBanner
          onLeaveReview={handleBannerLeaveReview}
          onDismiss={handleBannerDismiss}
        />
      )}
      {showPaidModal && (
        <ReviewModal
          userEmail={userEmail}
          userName={userName}
          context="paid"
          onClose={handlePaidModalClose}
          onSubmitted={handlePaidSubmitted}
        />
      )}
    </>
  )
}
