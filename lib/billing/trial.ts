/**
 * Billing quota logic.
 *
 * Free tier:   1 new patient file → leave a review → 5 more (total 6 free)
 * Basic plan:  KES 1,000/month → 20 new patient files per billing period
 * Pro plan:    KES 2,000/month → 50 new patient files per billing period
 *
 * One "patient file" = a block of 15 analysis slots for a single patient.
 * Slots are consumed by:
 *   - Each daily analysis (admission, day_N, discharge) — 1 slot each
 *   - Each re-analysis of the admission history (history edit) — 1 slot each
 *     (tracked via regeneration_count on the admission row)
 *
 * Formula per patient:
 *   total_slots = count(analyses rows) + admission_row.regeneration_count
 *   files_used  = ceil(total_slots / 15)
 *
 * Example: patient with 14 daily analyses + 3 history edits = 17 slots → 2 files
 *
 * All stored notes, summaries, and data remain accessible regardless of
 * subscription status. Analysis stops only when the subscription lapses or
 * the monthly patient-file limit is reached.
 *
 * OWNER_EMAILS bypass all limits entirely.
 *
 * PREREQUISITE: Run supabase/regeneration_count_migration.sql before deploying.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const FREE_TRIAL_LIMIT = 1
export const BONUS_TRIAL_LIMIT = 5   // unlocked after leaving a review
export const BASIC_PLAN_LIMIT = 20
export const PRO_PLAN_LIMIT = 50
export const ANALYSES_PER_FILE = 15  // slots per patient file before another file is consumed

export type PlanType = 'trial' | 'basic' | 'pro'

export interface TrialQuota {
  allowed: boolean
  used: number        // effective patient files consumed
  limit: number       // max patient files for this plan
  remaining: number
  subscribed: boolean
  exempt: boolean
  reviewRequired: boolean
  planType: PlanType
}

const OWNER_EMAILS = new Set(['mwiberimaureen@gmail.com'])

function getExemptEmails(): Set<string> {
  const raw = process.env.TRIAL_EXEMPT_EMAILS || ''
  const envEmails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return new Set([...OWNER_EMAILS, ...envEmails])
}

/**
 * Check whether the user can open a new patient file or continue analysis.
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

  const limit = subscribed
    ? planType === 'pro' ? PRO_PLAN_LIMIT : BASIC_PLAN_LIMIT
    : reviewSubmitted
      ? FREE_TRIAL_LIMIT + BONUS_TRIAL_LIMIT
      : FREE_TRIAL_LIMIT

  // ── Per-patient slot counting ──────────────────────────────────────────────
  // Fetch all non-deleted analyses for this user.
  // Each row = 1 slot. Admission row also carries regeneration_count (extra
  // slots from history edits). Scoped to the current billing period for
  // active subscribers.
  let analysesQuery = supabase
    .from('analyses')
    .select('patient_history_id, analysis_version, regeneration_count, patient_histories!inner(user_id)')
    .eq('patient_histories.user_id', userId)
    .is('deleted_at', null)

  if (subscribed && activeSub?.starts_at) {
    analysesQuery = analysesQuery.gte('created_at', activeSub.starts_at)
  }

  const { data: analysisRows } = await analysesQuery

  // Group by patient, accumulate row count and admission regenerations
  const perPatient = new Map<string, { rows: number; regens: number }>()
  for (const row of analysisRows || []) {
    const pid = row.patient_history_id
    const cur = perPatient.get(pid) ?? { rows: 0, regens: 0 }
    cur.rows += 1
    if (row.analysis_version === 'admission') {
      cur.regens += (row.regeneration_count ?? 0)
    }
    perPatient.set(pid, cur)
  }

  // Total files used = ceil((rows + regens) / 15) per patient
  let used = 0
  for (const { rows, regens } of perPatient.values()) {
    used += Math.ceil((rows + regens) / ANALYSES_PER_FILE)
  }

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
