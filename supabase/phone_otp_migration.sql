-- =====================================================
-- Phone OTP Verification Migration
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Prevents free-trial abuse by requiring a verified phone number at signup.
-- One phone number can only ever be bound to one account (UNIQUE constraint).
-- =====================================================

-- 1. Add phone_verified_at + make phone_number unique (partial index allows NULLs for legacy rows)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique
  ON public.users (phone_number)
  WHERE phone_number IS NOT NULL;

-- 2. OTP codes table — stores hashed codes with expiry + attempt limits
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  code_hash text NOT NULL,          -- SHA-256 hex digest of the 6-digit code
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamp with time zone,
  used_at timestamp with time zone, -- consumed by a successful signup
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_number ON public.otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_created_at ON public.otp_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);

-- 3. Lock the table down: no RLS-based access from regular users.
--    Only service role (via API routes) reads/writes it.
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles. Service role bypasses RLS.

-- 4. Daily cleanup — delete expired OTPs older than 24h
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  DELETE FROM public.otp_codes
  WHERE created_at < now() - interval '24 hours';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- 5. Schedule cleanup (pg_cron already enabled by auto_delete_migration)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-otp-codes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-otp-codes');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-otp-codes',
  '15 3 * * *',
  $$SELECT public.cleanup_expired_otp_codes();$$
);
