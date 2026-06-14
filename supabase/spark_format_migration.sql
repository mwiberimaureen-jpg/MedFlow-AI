-- Migration: Fix daily_learning_sparks format_type constraint
-- The old constraint had ('quiz','mystery','myth','flashcards').
-- The current code uses ('senior_asks','quick_teach','know_your_drugs','clinical_twist').
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.daily_learning_sparks
  DROP CONSTRAINT IF EXISTS daily_learning_sparks_format_type_check;

-- Clean up any stale sparks stored with the old format types BEFORE adding
-- the new constraint — ADD CONSTRAINT validates existing rows immediately,
-- so it fails with error 23514 if this runs after the constraint is added.
DELETE FROM public.daily_learning_sparks
WHERE format_type NOT IN ('senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist');

ALTER TABLE public.daily_learning_sparks
  ADD CONSTRAINT daily_learning_sparks_format_type_check
  CHECK (format_type IN ('senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist'));
