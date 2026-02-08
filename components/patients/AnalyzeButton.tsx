'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface AnalyzeButtonProps {
  patientId: string
}

export function AnalyzeButton({ patientId }: AnalyzeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/analyze`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze patient history')
      }

      // Refresh the page to show the new analysis
      router.refresh()

    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <Button
        onClick={handleAnalyze}
        loading={loading}
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Analyze Patient History'}
      </Button>
    </div>
  )
}
