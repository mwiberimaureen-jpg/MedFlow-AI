-- Migration: Add display name and phone number to users table
-- Run this in Supabase Dashboard → SQL Editor → New Query

alter table public.users
  add column if not exists full_name text,
  add column if not exists phone_number text;
