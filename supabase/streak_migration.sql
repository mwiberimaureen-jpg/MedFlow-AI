-- Migration: Add learning streak columns to profiles table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_spark_date date;
