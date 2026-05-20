/**
 * Billing quota logic.
 *
 * Free tier:   5 analyses → leave a review → 5 more (total 10 free)
 * Basic plan:  KES 1,000/month → 30 analyses per billing period
 * Pro plan:    KES 2,000/month → 75 analyses per billing period
 *
 * Only new admission analyses count against the quota.
 * Day notes, summaries, and all stored data remain accessible regardless
 * of subscription status.
 *
 * OWNER_EMAILS bypass all limits entirely.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const FREE_TRIAL_LIMIT = 5
export const BONUS_TRIAL_LIMIT = 5   // unlocked after leaving a review
export const BASIC_PLAN_LIMIT = 30
export const PRO_PLAN_LIMIT = 75

export type PlanType = 'trial' | 'basic' | 'pro'

export interface TrialQuota {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  subscribed: boolean
  exempt: boolean
  reviewRequired: boolean  // free tier exhausted, review unlocks 5 more
  planType: PlanType
}

const OWNER_EMAILS = new Set(['mwiberimaureen@gmail.com'])

function getExemptEmails(): Set<string> {
  const raw = process.env.TRIAL_EXEMPT_EMAILS || ''
  const envEmails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return new Set([...OWNER_EMAILS, ...envEmails])
}

/**
 * Check whether the user can run another admission analysis.
 *
 * Pass authEmail (from supabase.auth.getUser()) so the exempt check uses
 * the verified auth email rather than a potentially missing users table field.
 */
export async function getTrialQuota(
  supabase: SupabaseClient,
  userId: string,
  authEmail?: string | null
): Promise<TrialQuota> {
  // Fetch user record and active subscription in parallel
  const [userRes, subRes] = await Promise.all([
    supabase
      .from('users')
      .select('email, subscription_status, review_submitted')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan_type, starts_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const userRow = userRes.data
  const activeSub = subRes.data

  const subscribed = userRow?.subscription_status === 'active'
  const email = (authEmail || userRow?.email || '').toLowerCase()
  const exempt = email !== '' && getExemptEmails().has(email)
  const reviewSubmitted = userRow?.review_submitted === true

  const rawPlanType = activeSub?.plan_type || 'trial'
  const planType: PlanType = subscribed
    ? rawPlanType === 'pro' ? 'pro' : 'basic'
    : 'trial'

  // Effective quota limit for this user's current state
  const limit = subscribed
    ? planType === 'pro' ? PRO_PLAN_LIMIT : BASIC_PLAN_LIMIT
    : reviewSubmitted
      ? FREE_TRIAL_LIMIT + BONUS_TRIAL_LIMIT
      : FREE_TRIAL_LIMIT

  // Count admission analyses — scoped to current billing period for subscribers
  let query = supabase
    .from('analyses')
    .select('id, patient_histories!inner(user_id)', { count: 'exact', head: true })
    .eq('analysis_version', 'admission')
    .eq('patient_histories.user_id', userId)

  if (subscribed && activeSub?.starts_at) {
    query = query.gte('created_at', activeSub.starts_at)
  }

  const { count } = await query
  const used = count ?? 0
  const remaining = Math.max(0, limit - used)

  // Prompt for review once free tier is exhausted and review not yet submitted
  const reviewRequired = !subscribed && !exempt && used >= FREE_TRIAL_LIMIT && !reviewSubmitted

  return {
    allowed: subscribed || exempt || used < limit,
    used,
    limit,
    remaining,
    subscribed,
    exempt,
    reviewRequired,
    planType,
  }
}
