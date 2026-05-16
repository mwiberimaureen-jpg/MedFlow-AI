-- Storage policies for the clinical-pdfs bucket
-- Run AFTER creating the bucket in Supabase Dashboard → Storage → New bucket
-- Bucket name: clinical-pdfs  |  Public: off

-- Users can upload PDFs into their own folder (user_id/filename)
create policy "Users can upload own PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clinical-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own PDFs
create policy "Users can read own PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own PDFs
create policy "Users can delete own PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'clinical-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
