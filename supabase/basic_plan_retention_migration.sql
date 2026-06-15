-- =====================================================
-- Basic Plan Retention Migration
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Two new pg_cron jobs:
--
-- 1. cleanup_unedited_basic_plan_histories()
--    For users on the BASIC plan (subscription_status = 'active',
--    subscriptions.plan_type = 'basic'), soft-delete (move to trash)
--    any patient history that:
--      - has never been edited since creation (updated_at = created_at)
--      - is not starred (is_starred = false)
--      - is older than 1 month (created_at < now() - 30 days)
--
-- 2. purge_trashed_patient_histories()
--    Permanently (hard) delete any patient history that has been sitting
--    in the trash (deleted_at IS NOT NULL) for more than 3 days, cascading
--    through todo_items -> analyses -> patient_histories.
--
-- Both jobs run nightly, staggered after the existing
-- 'cleanup-old-patient-histories' job (03:00 UTC, see auto_delete_migration.sql)
-- and 'cleanup-expired-trial-data' job (03:30 UTC, see trial_expiry_migration.sql).
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Soft-delete un-edited, unstarred histories for basic-plan users after 1 month
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
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = ph.user_id
        AND s.status = 'active'
        AND s.plan_type = 'basic'
    );

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

-- 2. Permanently delete histories that have been in the trash for >3 days
CREATE OR REPLACE FUNCTION public.purge_trashed_patient_histories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids
  FROM public.patient_histories
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - interval '3 days');

  IF ids IS NULL THEN
    rows_affected := 0;
  ELSE
    DELETE FROM public.todo_items
    WHERE analysis_id IN (
      SELECT id FROM public.analyses WHERE patient_history_id = ANY(ids)
    );

    DELETE FROM public.analyses WHERE patient_history_id = ANY(ids);

    DELETE FROM public.patient_histories WHERE id = ANY(ids);

    rows_affected := array_length(ids, 1);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL,
    'patient.trash_purge',
    'patient_history',
    NULL,
    jsonb_build_object('rows_permanently_deleted', rows_affected, 'cutoff_days', 3)
  );

  RETURN rows_affected;
END;
$$;

-- 3. Schedule both jobs (unschedule first to avoid duplicates on re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-unedited-basic-plan-histories')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-unedited-basic-plan-histories');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-trashed-patient-histories')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-trashed-patient-histories');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-unedited-basic-plan-histories',
  '10 3 * * *',
  $$SELECT public.cleanup_unedited_basic_plan_histories();$$
);

SELECT cron.schedule(
  'purge-trashed-patient-histories',
  '40 3 * * *',
  $$SELECT public.purge_trashed_patient_histories();$$
);
