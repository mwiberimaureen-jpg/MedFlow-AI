'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TrialQuota {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  subscribed: boolean
}

export default function TrialBadge() {
  const [quota, setQuota] = useState<TrialQuota | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/auth/trial-status', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setQuota(data)
      } catch {}
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  if (!quota || quota.subscribed) return null

  const { used, limit, remaining } = quota
  const exhausted = remaining === 0
  const low = remaining <= 1

  return (
    <Link
      href="/dashboard/settings"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        exhausted
          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
          : low
          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
      }`}
      title={exhausted ? 'Trial exhausted — subscribe to continue' : `${remaining} free analyses remaining`}
    >
      <span className="font-semibold">{used}/{limit}</span>
      <span>{exhausted ? 'trial used — upgrade' : 'free analyses'}</span>
    </Link>
  )
}
