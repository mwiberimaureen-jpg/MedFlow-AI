-- Medical Workflow SaaS - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  phone_number text,
  subscription_status text default 'inactive' check (subscription_status in ('active', 'inactive', 'trialing')),
  subscription_ends_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Notion connections table
create table if not exists public.notion_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  notion_access_token text not null,
  notion_workspace_id text,
  notion_workspace_name text,
  notion_bot_id text,
  connected_at timestamp with time zone default now()
);

-- 3. Payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  phone_number text not null,
  intasend_invoice_id text,
  intasend_tracking_id text,
  mpesa_receipt_number text,
  status text default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- 4. Create indexes for performance
create index if not exists idx_notion_connections_user_id on public.notion_connections(user_id);
create index if not exists idx_notion_connections_workspace_id on public.notion_connections(notion_workspace_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_profiles_subscription_status on public.profiles(subscription_status);

-- 5. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.notion_connections enable row level security;
alter table public.payments enable row level security;

-- 6. RLS Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 7. RLS Policies for notion_connections
create policy "Users can view own notion connections"
  on public.notion_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own notion connections"
  on public.notion_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own notion connections"
  on public.notion_connections for delete
  using (auth.uid() = user_id);

-- 8. RLS Policies for payments
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- 9. Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- 10. Trigger to auto-create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 11. Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 12. Trigger for profiles updated_at
drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

-- 13. Daily Learning Sparks table
create table if not exists public.daily_learning_sparks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  spark_date date not null,
  format_type text not null check (format_type in ('quiz', 'mystery', 'myth', 'flashcards')),
  content jsonb not null,
  source_conditions text[],
  generated_at timestamp with time zone default now(),

  unique(user_id, spark_date)
);

create index if not exists idx_daily_learning_sparks_user_date
  on public.daily_learning_sparks(user_id, spark_date);

alter table public.daily_learning_sparks enable row level security;

create policy "Users can view own learning sparks"
  on public.daily_learning_sparks for select
  using (auth.uid() = user_id);

create policy "Users can insert own learning sparks"
  on public.daily_learning_sparks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own learning sparks"
  on public.daily_learning_sparks for update
  using (auth.uid() = user_id);

-- 14. Clinical Notes table
create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  source text not null default 'manual' check (source in ('manual', 'senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist')),
  spark_id text,
  tags text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_clinical_notes_user
  on public.clinical_notes(user_id, created_at desc);

alter table public.clinical_notes enable row level security;

create policy "Users can view own clinical notes"
  on public.clinical_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own clinical notes"
  on public.clinical_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clinical notes"
  on public.clinical_notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own clinical notes"
  on public.clinical_notes for delete
  using (auth.uid() = user_id);

drop trigger if exists update_clinical_notes_updated_at on public.clinical_notes;
create trigger update_clinical_notes_updated_at
  before update on public.clinical_notes
  for each row execute procedure public.update_updated_at_column();
