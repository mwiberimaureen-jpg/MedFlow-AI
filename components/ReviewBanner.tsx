'use client'

interface ReviewBannerProps {
  onLeaveReview: () => void
  onDismiss: () => void
}

export function ReviewBanner({ onLeaveReview, onDismiss }: ReviewBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-5 py-3 bg-blue-600 text-white shadow-lg">
      <p className="text-sm">
        <span className="font-medium">Enjoying MedFlow AI?</span>
        {' '}A quick review helps us reach more clinicians — it takes 30 seconds.
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onLeaveReview}
          className="px-3 py-1.5 bg-white text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors"
        >
          Leave a review
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-blue-200 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
