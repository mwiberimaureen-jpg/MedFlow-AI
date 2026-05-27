-- Migration: Add regeneration_count to analyses
--
-- Tracks how many times an admission analysis has been regenerated
-- (i.e. the user edited the initial patient history and re-ran AI analysis).
-- Each regeneration counts toward the 15-analysis-per-patient-file quota,
-- preventing the exploit of reusing one patient file for multiple patients
-- by repeatedly editing the history.
--
-- Run this in your Supabase SQL editor before deploying the corresponding
-- code changes.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS regeneration_count INT NOT NULL DEFAULT 0;
