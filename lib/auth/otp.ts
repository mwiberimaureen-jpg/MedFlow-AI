/**
 * Phone number normalization for signup flow.
 *
 * OTP issuance/verification is handled by Firebase Phone Auth — we only need
 * to canonicalize phone numbers before storing + uniqueness-checking them.
 */

/**
 * Normalize a phone number to E.164 format. Accepts common Kenyan formats
 * (07XX..., 2547XX..., +2547XX...) and returns +2547XXXXXXXX. Other
 * international numbers pass through if they already begin with +.
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
