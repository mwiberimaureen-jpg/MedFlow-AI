-- Migration: Add display_name (full_name) to users table
-- Run this in Supabase Dashboard → SQL Editor → New Query

alter table public.users
  add column if not exists full_name text;
