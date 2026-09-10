-- YT Creator Pro - Admin User Request Update Note + Screenshot
-- Additive only. Does not alter existing request/payment data or UI flows.

-- 1) Let all authorized admin/staff accounts save request notes.
drop policy if exists "feature_admin_notes" on public.request_notes;
create policy "feature_admin_notes" on public.request_notes
for all to authenticated
using (exists (select 1 from public.admin_users a where a.id=auth.uid()))
with check (exists (select 1 from public.admin_users a where a.id=auth.uid()));

-- 2) Let a normal logged-in user read notes belonging to their own request.
drop policy if exists "feature_user_request_notes" on public.request_notes;
create policy "feature_user_request_notes" on public.request_notes
for select to authenticated
using (exists (
  select 1
  from public.service_requests r
  join public.customers c on c.id=r.customer_id
  where r.id=request_notes.request_id
    and c.user_id=auth.uid()
));

-- 3) Let authorized admin/staff accounts attach screenshots to a request.
drop policy if exists "feature_admin_insert_documents" on public.request_documents;
create policy "feature_admin_insert_documents" on public.request_documents
for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.id=auth.uid()));

-- 4) The existing user-documents bucket is private and already limits files to 10 MB.
-- Add an admin/staff upload policy. Paths must start with the customer's UUID so
-- the existing user-read policy can safely expose only that customer's files.
drop policy if exists "feature_admin_insert_storage_documents" on storage.objects;
create policy "feature_admin_insert_storage_documents" on storage.objects
for insert to authenticated
with check (
  bucket_id='user-documents'
  and exists (select 1 from public.admin_users a where a.id=auth.uid())
  and exists (
    select 1 from public.customers c
    where c.id::text=(storage.foldername(name))[1]
  )
);
