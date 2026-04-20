-- Terms & Conditions acceptance tracking.
-- Users must accept the current terms before accessing the dashboard.
-- Bumping TERMS_VERSION in the app code forces re-acceptance of the new terms.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;
