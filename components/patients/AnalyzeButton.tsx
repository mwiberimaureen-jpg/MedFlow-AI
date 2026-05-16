'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ReviewModal } from '@/components/ReviewModal'
import { createClient } from '@/lib/supabase/client'

interface AnalyzeButtonProps {
  patientId: string
}

export function AnalyzeButton({ patientId }: AnalyzeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState<string | undefined>(undefined)
  const router = useRouter()

  async function runAnalysis() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/analyze`, { method: 'POST' })
      const data = await response.json()

      if (data.code === 'REVIEW_REQUIRED') {
        // Fetch user info for the modal then show it
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', user.id)
            .single()
          setUserEmail(profile?.email || user.email || '')
          setUserName(profile?.full_name || undefined)
        }
        setShowReview(true)
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze patient history')
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis')
      setLoading(false)
    }
  }

  async function handleReviewSubmitted() {
    setShowReview(false)
    // Review unlocked analyses — retry automatically
    await runAnalysis()
  }

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <Button onClick={runAnalysis} loading={loading} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Patient History'}
      </Button>

      {showReview && (
        <ReviewModal
          userEmail={userEmail}
          userName={userName}
          context="required"
          onClose={() => {}} // cannot close without submitting
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}
