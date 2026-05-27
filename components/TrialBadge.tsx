'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ReviewModal } from '@/components/ReviewModal'

interface TrialQuota {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  subscribed: boolean
  exempt?: boolean
  reviewRequired: boolean
  planType: 'trial' | 'basic' | 'pro'
}

interface UserInfo {
  email: string
  full_name?: string
}

export default function TrialBadge() {
  const [quota, setQuota] = useState<TrialQuota | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [showReview, setShowReview] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/auth/trial-status', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setQuota(data)
    } catch {}
  }

  async function loadUser() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('email, full_name').eq('id', user.id).single()
      if (data) setUserInfo({ email: data.email || user.email || '', full_name: data.full_name })
    } catch {}
  }

  useEffect(() => {
    load()
    loadUser()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!quota || quota.subscribed || quota.exempt) return null

  const { used, limit, remaining, reviewRequired } = quota
  const exhausted = remaining === 0
  const low = remaining <= 1

  // If review is required (free tier used up), show a prompt instead of the badge
  if (reviewRequired) {
    return (
      <>
        <button
          onClick={() => setShowReview(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300"
          title="Leave a review to unlock 5 more free patient files"
        >
          <span>⭐ Leave a review → unlock 5 more patients</span>
        </button>

        {showReview && userInfo && (
          <ReviewModal
            userEmail={userInfo.email}
            userName={userInfo.full_name}
            context="unlock"
            onClose={() => setShowReview(false)}
            onSubmitted={() => { setShowReview(false); load() }}
          />
        )}
      </>
    )
  }

  return (
    <Link
      href="/pricing"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        exhausted
          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
          : low
          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
      }`}
      title={exhausted ? 'Free patient files used — subscribe to continue' : `${remaining} free patients remaining`}
    >
      <span className="font-semibold">{used}/{limit}</span>
      <span>{exhausted ? 'free patients used — subscribe' : 'free patients'}</span>
    </Link>
  )
}
