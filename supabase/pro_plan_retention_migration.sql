-- =====================================================
-- Pro Plan Retention Migration
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Mirrors basic_plan_retention_migration.sql for PRO plan users, with a
-- longer 60-day window (vs 30 days for basic):
--
-- cleanup_unedited_pro_plan_histories()
--   For users on the PRO plan (subscription_status = 'active',
--   subscriptions.plan_type = 'pro'), soft-delete (move to trash)
--   any patient history that:
--     - has never been edited since creation (updated_at = created_at)
--     - is not starred (is_starred = false)
--     - is older than 2 months (created_at < now() - 60 days)
--
-- Trash purge (3 days, hard delete) is already handled globally by
-- purge_trashed_patient_histories() from basic_plan_retention_migration.sql
-- — no separate purge job is needed here.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Soft-delete un-edited, unstarred histories for pro-plan users after 2 months
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
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = ph.user_id
        AND s.status = 'active'
        AND s.plan_type = 'pro'
    );

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

-- Schedule (unschedule first to avoid duplicates on re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-unedited-pro-plan-histories')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-unedited-pro-plan-histories');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-unedited-pro-plan-histories',
  '15 3 * * *',
  $$SELECT public.cleanup_unedited_pro_plan_histories();$$
);
