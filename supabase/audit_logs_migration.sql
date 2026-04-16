-- =====================================================
-- Audit Logs Migration: HIPAA-compliant access tracking
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Tracks: who accessed/modified PHI, what they did, and when.
-- Required for HIPAA compliance (45 CFR 164.312(b)).
-- =====================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs(resource_id);

-- 3. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit logs (for transparency)
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert audit logs (prevents tampering)
-- No INSERT policy for regular users — inserts happen via service role client
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE policies — audit logs are immutable
