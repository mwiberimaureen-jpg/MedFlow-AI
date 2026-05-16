-- Migration: Add review_submitted flag to users table
-- Run in Supabase Dashboard → SQL Editor → New Query

alter table public.users
  add column if not exists review_submitted boolean not null default false;
