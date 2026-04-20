-- =====================================================
-- Phone Verification Migration (Firebase Phone Auth)
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Firebase handles OTP issuance + delivery + verification. We only need
-- to persist the verified phone number and enforce one-phone-per-account.
-- =====================================================

-- 1. Add verification timestamp column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamp with time zone;

-- 2. One phone = one account. Partial index allows legacy NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique
  ON public.users (phone_number)
  WHERE phone_number IS NOT NULL;
