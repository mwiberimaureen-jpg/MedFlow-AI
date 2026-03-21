'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RestorePatientButtonProps {
  patientId: string
}

export function RestorePatientButton({ patientId }: RestorePatientButtonProps) {
  const [isRestoring, setIsRestoring] = useState(false)
  const router = useRouter()

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) throw new Error('Failed to restore')
      router.refresh()
    } catch {
      alert('Failed to restore patient. Please try again.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <button
      onClick={handleRestore}
      disabled={isRestoring}
      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium disabled:opacity-50 transition-colors"
    >
      {isRestoring ? 'Restoring...' : 'Restore'}
    </button>
  )
}
