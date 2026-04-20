/**
 * Trial quota: each account gets N free admission analyses. Once that cap
 * is reached, the user must have an active subscription to run more.
 *
 * Follow-up work on trial patients (daily notes, discharge summaries) is
 * NOT counted against the quota — only the initial admission analysis is.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const TRIAL_ANALYSIS_LIMIT = 5

export interface TrialQuota {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  subscribed: boolean
}

/**
 * Check whether the user can run another admission analysis.
 * Active subscribers bypass the quota entirely.
 */
export async function getTrialQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<TrialQuota> {
  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle()

  const subscribed = userRow?.subscription_status === 'active'

  // Count admission analyses owned by this user (joined via patient_histories)
  const { count } = await supabase
    .from('analyses')
    .select('id, patient_histories!inner(user_id)', { count: 'exact', head: true })
    .eq('analysis_version', 'admission')
    .eq('patient_histories.user_id', userId)

  const used = count ?? 0
  const remaining = Math.max(0, TRIAL_ANALYSIS_LIMIT - used)

  return {
    allowed: subscribed || used < TRIAL_ANALYSIS_LIMIT,
    used,
    limit: TRIAL_ANALYSIS_LIMIT,
    remaining,
    subscribed,
  }
}
