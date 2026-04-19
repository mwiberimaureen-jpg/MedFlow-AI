-- =====================================================
-- Auto-Delete Old Patient Histories Migration
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Adds a user preference to auto-delete patient histories older than 90 days
-- and a pg_cron job that runs daily to enforce the policy.
--
-- Users can opt out via the Settings page; opted-out users retain all data.
-- =====================================================

-- 1. Add opt-out column to users table (default: auto-delete enabled)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_delete_histories boolean NOT NULL DEFAULT true;

-- 1b. Add per-history star flag: starred histories are never auto-deleted
ALTER TABLE public.patient_histories
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_patient_histories_is_starred
  ON public.patient_histories(is_starred)
  WHERE is_starred = true;

-- 2. Enable pg_cron extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Soft-delete function: marks histories >90 days old as deleted for opted-in users,
--    skipping any history the user has starred to retain.
CREATE OR REPLACE FUNCTION public.cleanup_old_patient_histories()
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
  FROM public.users u
  WHERE ph.user_id = u.id
    AND u.auto_delete_histories = true
    AND ph.deleted_at IS NULL
    AND ph.is_starred = false
    AND ph.created_at < (now() - interval '90 days');

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL,
    'patient.auto_delete',
    'patient_history',
    NULL,
    jsonb_build_object('rows_soft_deleted', rows_affected, 'cutoff_days', 90)
  );

  RETURN rows_affected;
END;
$$;

-- 4. Schedule daily job at 03:00 UTC (unschedule if already exists to avoid duplicates)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-patient-histories')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-patient-histories');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-patient-histories',
  '0 3 * * *',
  $$SELECT public.cleanup_old_patient_histories();$$
);
