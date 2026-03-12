'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls the patient status while analysis is in progress.
 * When analysis completes, triggers a page refresh to show results.
 */
export function AnalysisPoller({ patientId }: { patientId: string }) {
  const router = useRouter()

  useEffect(() => {
    let active = true

    const poll = async () => {
      while (active) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        if (!active) break

        try {
          const res = await fetch(`/api/patients/${patientId}`, { cache: 'no-store' })
          if (!res.ok) continue
          const data = await res.json()

          if (data.patient?.status !== 'analyzing') {
            // Analysis finished (completed or errored) — refresh the page
            router.refresh()
            break
          }
        } catch {
          // Network error — keep trying
        }
      }
    }

    poll()

    return () => { active = false }
  }, [patientId, router])

  return null
}
