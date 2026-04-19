'use client'

import { useState } from 'react'

interface StarPatientButtonProps {
  patientId: string
  initialStarred: boolean
  size?: 'sm' | 'md'
}

export function StarPatientButton({ patientId, initialStarred, size = 'sm' }: StarPatientButtonProps) {
  const [starred, setStarred] = useState(initialStarred)
  const [busy, setBusy] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const next = !starred
    setStarred(next)
    try {
      const res = await fetch(`/api/patients/${patientId}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: next }),
      })
      if (!res.ok) setStarred(!next)
    } catch {
      setStarred(!next)
    } finally {
      setBusy(false)
    }
  }

  const dim = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={starred ? 'Unstar (allow auto-delete)' : 'Star to keep — never auto-deleted'}
      aria-label={starred ? 'Unstar patient' : 'Star patient to retain'}
      className={`transition-colors p-1 disabled:opacity-50 ${
        starred
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400'
      }`}
    >
      <svg
        className={dim}
        fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.1 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.673z"
        />
      </svg>
    </button>
  )
}
