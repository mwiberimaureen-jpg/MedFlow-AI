'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ReviewModal } from '@/components/ReviewModal'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  phone_number?: string
  subscription_status: string
  subscription_expires_at?: string
  created_at?: string
  auto_delete_histories?: boolean
  referral_code?: string
  referral_count?: number
  referral_credits?: number
  avatar_url?: string
}

interface Subscription {
  id: string
  status: string
  plan_type: string
  amount: number
  currency: string
  payment_method?: string
  starts_at?: string
  expires_at?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Editable fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [autoDelete, setAutoDelete] = useState(true)
  const [savingRetention, setSavingRetention] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/login')
        return
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') throw profileError

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || '')
        setPhoneNumber(profileData.phone_number || '')
        setAutoDelete(profileData.auto_delete_histories !== false)

        // Generate referral code for existing users who don't have one yet
        if (!profileData.referral_code) {
          fetch('/api/referral/ensure', { method: 'POST' })
            .then(r => r.json())
            .then(d => {
              if (d.referral_code) {
                setProfile(prev => prev ? { ...prev, referral_code: d.referral_code } : null)
              }
            })
            .catch(() => {})
        }
      }

      // Fetch active subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (subData) {
        setSubscription(subData)
      }
    } catch (err) {
      console.error('Error fetching settings data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile() {
    setSaving(true)
    setProfileMessage(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          phone_number: phoneNumber.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setProfileMessage({ type: 'error', text: data.error || 'Failed to save. Please try again.' })
      } else if (data.warning) {
        setProfileMessage({ type: 'error', text: data.warning })
      } else {
        setProfileMessage({ type: 'success', text: 'Changes saved successfully!' })
        setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), phone_number: phoneNumber.trim() } : null)
      }
    } catch {
      setProfileMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAutoDelete(next: boolean) {
    if (!profile) return
    setSavingRetention(true)
    setMessage(null)
    const previous = autoDelete
    setAutoDelete(next)

    const { error } = await supabase
      .from('users')
      .update({ auto_delete_histories: next })
      .eq('id', profile.id)

    if (error) {
      setAutoDelete(previous)
      setMessage({ type: 'error', text: 'Failed to update retention preference. Please try again.' })
    } else {
      setProfile(prev => prev ? { ...prev, auto_delete_histories: next } : null)
      setMessage({
        type: 'success',
        text: next
          ? 'Auto-delete enabled. Histories older than 90 days will be cleaned up daily.'
          : 'Auto-delete disabled. Your histories will be retained indefinitely.',
      })
    }
    setSavingRetention(false)
  }

  async function handlePasswordReset() {
    if (!profile?.email) return
    setMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      setMessage({ type: 'error', text: 'Failed to send password reset email.' })
    } else {
      setMessage({ type: 'success', text: `Password reset email sent to ${profile.email}.` })
    }
  }

  function compressImage(file: File, maxPx = 400, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > 20 * 1024 * 1024) {
      setProfileMessage({ type: 'error', text: 'Image must be smaller than 20 MB.' })
      return
    }

    setUploadingAvatar(true)
    try {
      const compressed = await compressImage(file)
      const path = `${profile.id}/avatar.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // Append cache-buster so browsers don't serve a stale image after re-upload
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save avatar URL to database')
      }

      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null)
      setProfileMessage({ type: 'success', text: 'Profile photo updated!' })
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err?.message || 'Failed to upload photo.' })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  function getStatusBadge(status?: string) {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    }
    const label = status || 'inactive'
    return (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[label] || styles.inactive}`}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and payment preferences</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Account Info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Account Information</h2>

        <div className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Email cannot be changed</p>
          </div>

          {/* Avatar + Display Name */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative group w-16 h-16 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Change profile photo"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-2xl select-none">
                    {(fullName || profile?.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500">Photo</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="flex-1">
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Zee"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">How the app greets you — e.g. &quot;Welcome back, Dr. Zee&quot;</p>
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
            <input
              id="phone_number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Member Since */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Member Since</label>
            <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(profile?.created_at)}</p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleSaveProfile} loading={saving} disabled={saving}>
                Save Changes
              </Button>
              <button
                onClick={handlePasswordReset}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset Password
              </button>
            </div>
            {profileMessage && (
              <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                profileMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
              }`}>
                {profileMessage.text}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Data Retention */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Data Retention</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Manage how long patient histories are kept in your account.
        </p>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Auto-delete histories after 90 days
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              When enabled, patient histories older than 90 days are automatically removed to reduce clutter.
              Turn off to retain all histories indefinitely.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoDelete}
            aria-label="Toggle auto-delete"
            onClick={() => handleToggleAutoDelete(!autoDelete)}
            disabled={savingRetention}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              autoDelete ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoDelete ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Payment Method / Subscription */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Payment & Subscription</h2>

        {/* Current Plan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {subscription ? 'Monthly Subscription' : 'No active plan'}
              </p>
            </div>
            {getStatusBadge(profile?.subscription_status)}
          </div>

          {subscription && (
            <>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {subscription.currency} {subscription.amount?.toLocaleString()}/month
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Method</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {subscription.payment_method || 'Intasend (M-PESA / Card)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Started</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {formatDate(subscription.starts_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Renews On</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {formatDate(subscription.expires_at)}
                  </p>
                </div>
              </div>
            </>
          )}

          {!subscription && profile?.subscription_status === 'trialing' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                You are on a free trial{profile.subscription_expires_at ? ` until ${formatDate(profile.subscription_expires_at)}` : ''}.
                Subscribe to continue using MedFlow AI after your trial ends.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Payments processed securely via Intasend. Accepted: M-PESA, Visa, Mastercard.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              Your notes, summaries, and patient data remain accessible even without an active subscription.
            </p>
            <div className="flex items-center gap-3">
              {!subscription && (
                <Button variant="primary" onClick={() => router.push('/pricing')}>
                  Subscribe Now
                </Button>
              )}
              {subscription && (
                <Button variant="primary" onClick={() => router.push('/pricing')}>
                  Manage Plan
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
      {/* Referral Program */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Referral Program</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Share your code with a colleague. When they join MedFlow using your code, you earn a credit worth 25% of their subscription — applied to your next renewal.
        </p>

        {profile?.referral_code ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your referral code</p>
                <p className="text-3xl font-bold font-mono tracking-widest text-gray-900 dark:text-white">
                  {profile.referral_code}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(profile!.referral_code!)
                  setCodeCopied(true)
                  setTimeout(() => setCodeCopied(false), 2000)
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {codeCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {(profile.referral_count ?? 0) > 0 ? (
                <p>
                  You&apos;ve referred <strong>{profile.referral_count}</strong>{' '}
                  {profile.referral_count === 1 ? 'user' : 'users'}.
                  {(profile.referral_credits ?? 0) > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {' '}You have <strong>{profile.referral_credits}</strong> referral{' '}
                      {profile.referral_credits === 1 ? 'credit' : 'credits'} — 25% off your next subscription.
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">No referrals yet. Share your code to get started.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">Generating your referral code…</p>
        )}
      </Card>

      {/* Support */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Contact Support</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Have a complaint, question, or need help? Reach us and we&apos;ll get back to you as soon as possible.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email Support</p>
              <a
                href="mailto:medflowai.ke@gmail.com"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                medflowai.ke@gmail.com
              </a>
            </div>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>When contacting support, please include:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Your account email address</li>
              <li>A description of the issue or complaint</li>
              <li>Any relevant patient history IDs (do not include real patient names)</li>
            </ul>
          </div>

          <a
            href={`mailto:medflowai.ke@gmail.com?subject=MedFlow AI Support Request&body=Account email: ${profile?.email || ''}%0A%0ADescribe your issue:%0A`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Email
          </a>
        </div>
      </Card>

      {/* Leave a Review */}
      <LeaveReviewCard email={profile?.email || ''} fullName={fullName} />

      <GeneratePatientIdsCard />
    </div>
  )
}

function GeneratePatientIdsCard() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function handleGenerate() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/generate-patient-ids', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult({ message: data.error || 'Failed to generate IDs.', type: 'error' })
      } else {
        setResult({ message: data.message, type: 'success' })
      }
    } catch {
      setResult({ message: 'Network error. Please try again.', type: 'error' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Generate Patient IDs</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Assigns a unique 10-character MedFlow ID (e.g. MF3K9P2M7X) to any existing patient that doesn&apos;t have one. New patients get IDs automatically.
      </p>
      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          result.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
        }`}>
          {result.message}
        </div>
      )}
      <Button variant="secondary" onClick={handleGenerate} loading={running} disabled={running}>
        {running ? 'Generating IDs…' : 'Generate Patient IDs'}
      </Button>
    </Card>
  )
}


function LeaveReviewCard({ email, fullName }: { email: string; fullName: string }) {
  const [showModal, setShowModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmitted() {
    setShowModal(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
  }

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Leave a Review</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Your feedback helps us improve MedFlow AI for clinicians everywhere. Takes 30 seconds.
        </p>
        {submitted && (
          <div className="mb-3 px-4 py-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            Thank you for your review! 🙏
          </div>
        )}
        <Button variant="secondary" onClick={() => setShowModal(true)}>
          ⭐ Rate MedFlow AI
        </Button>
      </Card>

      {showModal && (
        <ReviewModal
          userEmail={email}
          userName={fullName}
          context="trial"
          onClose={() => setShowModal(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </>
  )
}

