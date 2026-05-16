-- Migration: PDF protocols & guidelines in notes
-- Run in Supabase Dashboard → SQL Editor → New Query

-- 1. Add pdf_url column to clinical_notes
alter table public.clinical_notes
  add column if not exists pdf_url text;

-- 2. Update the source check constraint to include 'pdf'
alter table public.clinical_notes
  drop constraint if exists clinical_notes_source_check;

alter table public.clinical_notes
  add constraint clinical_notes_source_check
  check (source in ('manual', 'senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist', 'pdf'));

-- 3. Create the Supabase Storage bucket for PDFs
-- (If this errors, create the bucket manually in Storage → New Bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-pdfs',
  'clinical-pdfs',
  false,
  20971520, -- 20 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- 4. Storage RLS: users can only access files in their own folder
create policy "Users can upload own PDFs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinical-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own PDFs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
