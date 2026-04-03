'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  phone_number?: string
  subscription_status: string
  subscription_expires_at?: string
  created_at?: string
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

  // Editable fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

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
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || '')
        setPhoneNumber(profileData.phone_number || '')
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
    if (!profile) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('users')
      .update({
        full_name: fullName.trim() || null,
        phone_number: phoneNumber.trim() || null,
      })
      .eq('id', profile.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' })
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully.' })
      setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), phone_number: phoneNumber.trim() } : null)
    }
    setSaving(false)
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

          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Jane Doe"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
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

          <div className="flex items-center gap-3 pt-2">
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Payments processed securely via Intasend. Accepted: M-PESA, Visa, Mastercard.
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
    </div>
  )
}
