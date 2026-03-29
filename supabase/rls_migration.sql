-- =====================================================
-- RLS Migration: Enable Row Level Security for ALL tables
-- =====================================================
-- Applied on 2026-03-29.
-- All 10 public tables now have RLS enabled with user-scoped policies.
--
-- Tables already had RLS: profiles, notion_connections, payments,
-- analyses, clinical_notes, todo_items, daily_learning_sparks, patient_histories
--
-- Tables that needed RLS added: subscriptions, users
-- =====================================================

-- subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- users table (id references auth.users)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own user record"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);
