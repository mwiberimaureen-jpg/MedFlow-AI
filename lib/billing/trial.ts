/**
 * Trial quota: each account gets N free admission analyses. Once that cap
 * is reached, the user must have an active subscription to run more.
 *
 * Follow-up work on trial patients (daily notes, discharge summaries) is
 * NOT counted against the quota — only the initial admission analysis is.
 *
 * Accounts whose email is listed in TRIAL_EXEMPT_EMAILS bypass the cap
 * entirely (for the owner/admin accounts used in production testing).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const TRIAL_ANALYSIS_LIMIT = 5

export interface TrialQuota {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  subscribed: boolean
  exempt: boolean
}

function getExemptEmails(): Set<string> {
  const raw = process.env.TRIAL_EXEMPT_EMAILS || ''
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Check whether the user can run another admission analysis.
 * Active subscribers and exempt admins bypass the quota entirely.
 */
export async function getTrialQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<TrialQuota> {
  const { data: userRow } = await supabase
    .from('users')
    .select('email, subscription_status')
    .eq('id', userId)
    .maybeSingle()

  const subscribed = userRow?.subscription_status === 'active'
  const email = (userRow?.email || '').toLowerCase()
  const exempt = email !== '' && getExemptEmails().has(email)

  // Count admission analyses owned by this user (joined via patient_histories)
  const { count } = await supabase
    .from('analyses')
    .select('id, patient_histories!inner(user_id)', { count: 'exact', head: true })
    .eq('analysis_version', 'admission')
    .eq('patient_histories.user_id', userId)

  const used = count ?? 0
  const remaining = Math.max(0, TRIAL_ANALYSIS_LIMIT - used)

  return {
    allowed: subscribed || exempt || used < TRIAL_ANALYSIS_LIMIT,
    used,
    limit: TRIAL_ANALYSIS_LIMIT,
    remaining,
    subscribed,
    exempt,
  }
}
