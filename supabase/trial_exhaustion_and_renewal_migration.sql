-- =====================================================
-- Trial Exhaustion & Plan-Renewal Retention Migration
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Two changes:
--
-- 1. FREE TRIAL: previously, cleanup_expired_trial_data() purged a
--    non-subscribed user's data once their ACCOUNT was >30 days old.
--    Now it only fires once their free trial QUOTA is fully used up
--    (tracked via the new users.trial_exhausted_at, set by
--    getTrialQuota() in lib/billing/trial.ts the first time a
--    non-subscribed/non-exempt user hits their limit), and gives them
--    10 days from that point to subscribe before their patient data is
--    permanently deleted.
--
-- 2. BASIC/PRO RETENTION: cleanup_unedited_basic_plan_histories() and
--    cleanup_unedited_pro_plan_histories() previously required
--    subscriptions.status = 'active'. Now they key off the user's MOST
--    RECENT subscription's plan_type regardless of its current status,
--    so a basic/pro user who fails to renew still gets the SAME 30/60-day
--    un-edited+unstarred retention window they had while subscribed,
--    instead of falling through to a different rule.
-- =====================================================

-- 1a. Add the exhaustion-timestamp column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_exhausted_at TIMESTAMPTZ;

-- 1b. Update the trial purge function: 10 days after trial_exhausted_at
--     instead of 30 days after account creation.
CREATE OR REPLACE FUNCTION public.cleanup_expired_trial_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purge_count integer := 0;
BEGIN
  -- Identify free-tier users whose trial quota has been exhausted for
  -- >10 days and who still haven't subscribed
  -- (subscription_status != 'active' covers both 'inactive' and null)
  DELETE FROM public.todo_items ti
  USING public.analyses a
  JOIN public.users u ON a.user_id = u.id
  WHERE ti.analysis_id = a.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.trial_exhausted_at IS NOT NULL
    AND u.trial_exhausted_at < now() - interval '10 days';

  DELETE FROM public.analyses a
  USING public.users u
  WHERE a.user_id = u.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.trial_exhausted_at IS NOT NULL
    AND u.trial_exhausted_at < now() - interval '10 days';

  DELETE FROM public.patient_histories ph
  USING public.users u
  WHERE ph.user_id = u.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.trial_exhausted_at IS NOT NULL
    AND u.trial_exhausted_at < now() - interval '10 days';

  -- Mark users as purged so they cannot start a new free trial
  UPDATE public.users
  SET trial_data_purged_at = now()
  WHERE subscription_status != 'active'
    AND trial_data_purged_at IS NULL
    AND trial_exhausted_at IS NOT NULL
    AND trial_exhausted_at < now() - interval '10 days';

  GET DIAGNOSTICS purge_count = ROW_COUNT;

  BEGIN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      NULL,
      'trial.data_purged',
      'user',
      NULL,
      jsonb_build_object('users_purged', purge_count, 'cutoff_days', 10, 'trigger', 'trial_exhausted')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN purge_count;
END;
$$;

-- 2a. Basic plan: key off most recent subscription's plan_type, not status
CREATE OR REPLACE FUNCTION public.cleanup_unedited_basic_plan_histories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE public.patient_histories ph
  SET deleted_at = now()
  WHERE ph.deleted_at IS NULL
    AND ph.is_starred = false
    AND ph.updated_at = ph.created_at
    AND ph.created_at < (now() - interval '30 days')
    AND (
      SELECT s.plan_type FROM public.subscriptions s
      WHERE s.user_id = ph.user_id
      ORDER BY s.created_at DESC
      LIMIT 1
    ) = 'basic';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL,
    'patient.auto_delete_basic_plan',
    'patient_history',
    NULL,
    jsonb_build_object('rows_soft_deleted', rows_affected, 'cutoff_days', 30, 'plan', 'basic')
  );

  RETURN rows_affected;
END;
$$;

-- 2b. Pro plan: key off most recent subscription's plan_type, not status
CREATE OR REPLACE FUNCTION public.cleanup_unedited_pro_plan_histories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE public.patient_histories ph
  SET deleted_at = now()
  WHERE ph.deleted_at IS NULL
    AND ph.is_starred = false
    AND ph.updated_at = ph.created_at
    AND ph.created_at < (now() - interval '60 days')
    AND (
      SELECT s.plan_type FROM public.subscriptions s
      WHERE s.user_id = ph.user_id
      ORDER BY s.created_at DESC
      LIMIT 1
    ) = 'pro';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL,
    'patient.auto_delete_pro_plan',
    'patient_history',
    NULL,
    jsonb_build_object('rows_soft_deleted', rows_affected, 'cutoff_days', 60, 'plan', 'pro')
  );

  RETURN rows_affected;
END;
$$;

-- No re-scheduling needed: CREATE OR REPLACE updates the function bodies in
-- place, and the existing cron jobs (cleanup-expired-trial-data,
-- cleanup-unedited-basic-plan-histories, cleanup-unedited-pro-plan-histories)
-- keep calling the same function names.
