-- Migration: Create reviews table
-- Run this in Supabase Dashboard → SQL Editor → New Query

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  email text,
  name text,
  rating integer not null check (rating between 1 and 5),
  feedback text,
  context text not null default 'trial' check (context in ('trial', 'paid')),
  created_at timestamp with time zone default now()
);

alter table public.reviews enable row level security;

-- Only the service role (used by the API route) can insert/read reviews
create policy "Service role manages reviews"
  on public.reviews
  using (false)
  with check (false);
