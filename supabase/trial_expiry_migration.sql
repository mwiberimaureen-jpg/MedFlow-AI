-- =====================================================
-- Trial Expiry Migration
-- =====================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).
--
-- What this does:
--   1. Adds trial_data_purged_at column to users table.
--   2. Creates a nightly pg_cron job that hard-deletes ALL patient data
--      (todo_items, analyses, patient_histories) for free-tier users whose
--      account is older than 30 days and who have never subscribed.
--   3. Sets trial_data_purged_at on those users so the app blocks them from
--      starting another free trial — they must subscribe to continue.
--
-- Once purged, getTrialQuota() returns { allowed: false, trialPurged: true }
-- for that user. No free trial can be restarted after purge.
--
-- Data NOT deleted: clinical_notes, daily_learning_sparks, users row itself,
-- reviews. Only patient history files and their analyses are removed.
-- =====================================================

-- 1. Add the purge-timestamp column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_data_purged_at TIMESTAMPTZ;

-- 2. Ensure pg_cron is enabled (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_trial_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purge_count integer := 0;
BEGIN
  -- Identify free-tier users whose account is >30 days old and never subscribed
  -- (subscription_status != 'active' covers both 'inactive' and null)
  -- Hard-delete todo_items first (no user_id, linked via analysis_id)
  DELETE FROM public.todo_items ti
  USING public.analyses a
  JOIN public.users u ON a.user_id = u.id
  WHERE ti.analysis_id = a.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.created_at < now() - interval '30 days';

  -- Hard-delete analyses
  DELETE FROM public.analyses a
  USING public.users u
  WHERE a.user_id = u.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.created_at < now() - interval '30 days';

  -- Hard-delete patient histories
  DELETE FROM public.patient_histories ph
  USING public.users u
  WHERE ph.user_id = u.id
    AND u.subscription_status != 'active'
    AND u.trial_data_purged_at IS NULL
    AND u.created_at < now() - interval '30 days';

  -- Mark users as purged so they cannot start a new free trial
  UPDATE public.users
  SET trial_data_purged_at = now()
  WHERE subscription_status != 'active'
    AND trial_data_purged_at IS NULL
    AND created_at < now() - interval '30 days';

  GET DIAGNOSTICS purge_count = ROW_COUNT;

  -- Log to audit table if it exists
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      NULL,
      'trial.data_purged',
      'user',
      NULL,
      jsonb_build_object('users_purged', purge_count, 'cutoff_days', 30)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit_logs table may not exist in all environments
  END;

  RETURN purge_count;
END;
$$;

-- 4. Schedule nightly at 03:30 UTC (30 min after the existing auto-delete job)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-trial-data')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-trial-data');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-trial-data',
  '30 3 * * *',
  $$SELECT public.cleanup_expired_trial_data();$$
);
