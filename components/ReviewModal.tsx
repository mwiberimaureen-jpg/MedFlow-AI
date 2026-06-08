'use client'

import { useState } from 'react'

interface ReviewModalProps {
  userEmail: string
  userName?: string
  // unlock  = free tier exhausted, review unlocks 5 more analyses (no skip)
  // renewal = mandatory before 2nd month payment (no skip)
  // paid    = optional before 3rd month payment (skippable)
  // trial   = voluntary from settings (skippable)
  context: 'trial' | 'paid' | 'unlock' | 'renewal'
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({ userEmail, userName, context, onClose, onSubmitted }: ReviewModalProps) {
  const isSkippable = context === 'trial' || context === 'paid'

  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (rating === 0) { setError('Please select a star rating.'); return }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback, userEmail, userName, context }),
      })
      if (!res.ok) {
        setError('Failed to submit — please try again.')
      } else {
        setDone(true)
        setTimeout(onSubmitted, 1800)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeStars = hovered || rating

  const title =
    context === 'unlock' ? 'Unlock 5 more free analyses' :
    context === 'renewal' ? 'Before you renew — share your experience' :
    context === 'trial' ? 'How are you finding MedFlow AI?' :
    'Enjoying MedFlow AI?'

  const subtitle =
    context === 'unlock' ? "You've used your free patient file. Leave a quick review to unlock 5 more — it takes 30 seconds." :
    context === 'renewal' ? 'A quick review is required before renewing. It takes 30 seconds.' :
    context === 'trial' ? "Your early feedback shapes what we build next." :
    'Leave a review before renewing — it means a lot to our small team.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSkippable ? onClose : undefined} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md">
        {isSkippable && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🙏</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Thank you!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your feedback helps us build a better tool for clinicians.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">🩺</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            </div>

            {/* Star rating */}
            <div className="flex justify-center gap-3 mb-5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                >
                  <svg
                    className={`w-11 h-11 transition-colors ${activeStars >= star ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </button>
              ))}
            </div>

            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="What's working well? What could be better? (optional)"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

            <div className="flex gap-2 mt-4">
              {isSkippable && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {context === 'paid' ? 'Skip for now' : 'Maybe later'}
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={`py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors ${isSkippable ? 'flex-1' : 'w-full'}`}
              >
                {submitting ? 'Sending…' : 'Submit Review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
