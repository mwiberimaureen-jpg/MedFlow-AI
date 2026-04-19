/**
 * One-Time Password (OTP) helpers for phone verification at signup.
 *
 * - Generates a 6-digit numeric code
 * - Stores only the SHA-256 hash in the DB (never the plaintext)
 * - Enforces rate limits: max 3 sends per phone per hour, max 5 attempts per code
 * - Expires codes after 10 minutes
 */

import { createHash, randomInt, timingSafeEqual } from 'crypto'

export const OTP_EXPIRY_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_MAX_SENDS_PER_HOUR = 3

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function verifyOtpHash(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtpCode(code), 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Normalize a phone number to E.164-ish format. Accepts common Kenyan formats
 * and returns +2547XXXXXXXX. Other international numbers pass through if they
 * already begin with +.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim().replace(/\s|-/g, '')

  if (/^\+\d{10,15}$/.test(trimmed)) return trimmed
  if (/^0[17]\d{8}$/.test(trimmed)) return '+254' + trimmed.slice(1)
  if (/^254[17]\d{8}$/.test(trimmed)) return '+' + trimmed
  if (/^[17]\d{8}$/.test(trimmed)) return '+254' + trimmed

  return null
}
