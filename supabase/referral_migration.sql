-- Migration: Referral system
--
-- Each user gets a unique 4-digit referral code.
-- When someone subscribes using a referral code, the referred user gets 25% off
-- and the referrer earns a credit (25% off their next subscription).
--
-- Run this in the Supabase SQL editor before deploying.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code CHAR(4) UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   CHAR(4),
  ADD COLUMN IF NOT EXISTS referral_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_credits INT NOT NULL DEFAULT 0;
