-- Storage policies for the clinical-pdfs bucket
-- Run AFTER creating the bucket in Supabase Dashboard → Storage → New bucket
-- Bucket name: clinical-pdfs  |  Public: off

-- Drop old policies if they exist from a previous attempt
drop policy if exists "Users can upload own PDFs" on storage.objects;
drop policy if exists "Users can read own PDFs" on storage.objects;
drop policy if exists "Users can delete own PDFs" on storage.objects;

-- Upload path is: {user_id}/{timestamp}-{filename}
-- split_part(name, '/', 1) extracts the first folder = user_id

create policy "Users can upload own PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clinical-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users can read own PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users can delete own PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );
