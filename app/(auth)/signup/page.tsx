'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFirebaseAuth } from '@/lib/firebase/client'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth'
import Link from 'next/link'

type Step = 'details' | 'otp' | 'success'

export default function SignupPage() {
  const [step, setStep] = useState<Step>('details')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const recaptchaContainerRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  // Clean up any Firebase recaptcha widget on unmount
  useEffect(() => {
    return () => {
      try {
        recaptchaVerifierRef.current?.clear()
      } catch {}
    }
  }, [])

  const ensureRecaptcha = () => {
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current
    const auth = getFirebaseAuth()
    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })
    return recaptchaVerifierRef.current
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    const normalized = phone.trim().replace(/\s|-/g, '')
    if (!/^\+\d{10,15}$/.test(normalized) && !/^0[17]\d{8}$/.test(normalized)) {
      setError('Enter a valid phone number in international format (e.g. +254712345678)')
      return
    }
    const intlPhone = normalized.startsWith('0')
      ? '+254' + normalized.slice(1)
      : normalized

    setLoading(true)
    try {
      const auth = getFirebaseAuth()
      const verifier = ensureRecaptcha()
      const confirmation = await signInWithPhoneNumber(auth, intlPhone, verifier)
      confirmationRef.current = confirmation
      setStep('otp')
    } catch (err: any) {
      console.error('[SIGNUP] signInWithPhoneNumber failed:', err)
      // Reset reCAPTCHA so the next attempt starts fresh
      try {
        recaptchaVerifierRef.current?.clear()
      } catch {}
      recaptchaVerifierRef.current = null
      setError(err?.code === 'auth/invalid-phone-number'
        ? 'Invalid phone number format'
        : err?.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code')
      return
    }
    if (!confirmationRef.current) {
      setError('Please request a new code')
      setStep('details')
      return
    }

    setLoading(true)
    try {
      const credential = await confirmationRef.current.confirm(code)
      const firebaseIdToken = await credential.user.getIdToken()

      const res = await fetch('/api/auth/signup-with-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firebaseIdToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Signup failed')
        return
      }
      setStep('success')
    } catch (err: any) {
      console.error('[SIGNUP] verify failed:', err)
      setError(err?.code === 'auth/invalid-verification-code'
        ? 'Incorrect verification code'
        : err?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    try {
      setError(null)
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (error: any) {
      setError(error.message || 'An error occurred with Google signup')
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-600 mb-6">
            Your phone is verified. We&apos;ve sent a confirmation link to <strong>{email}</strong> — click it to activate your account.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
        <p className="text-gray-600 mt-2">
          {step === 'details' ? 'Join our medical platform' : 'Verify your phone number'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {step === 'details' && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing up...' : 'Continue with Google'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="doctor@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+254 7XX XXX XXX"
              />
              <p className="text-xs text-gray-500 mt-1">We&apos;ll send a 6-digit code to verify this number.</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending code...' : 'Send Verification Code'}
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyAndSignup} className="space-y-6">
          <div className="text-sm text-gray-600">
            Enter the 6-digit code sent to <strong>{phone}</strong>.
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify & Create Account'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setStep('details'); setCode(''); setError(null); confirmationRef.current = null }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Edit details
            </button>
          </div>
        </form>
      )}

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} />

      <p className="text-center mt-6 text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
