-- Terms & Conditions acceptance tracking.
-- Users must accept the current terms before accessing the dashboard.
-- Bumping TERMS_VERSION in lib/legal/terms.ts forces re-acceptance.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_version text;
