-- YT Creator Pro - Service Charge Edit/Update permission fix
-- Safe additive repair: does not change layout, service data, or payment flow.
-- Run once in Supabase SQL Editor.

alter table public.service_charges enable row level security;

-- Admin is accepted either by matching Auth UUID or by matching the
-- authenticated email stored in public.admin_users. This keeps existing
-- UUID-based admin setups working and repairs email-based admin setups.
drop policy if exists "admin can insert service charges" on public.service_charges;
create policy "admin can insert service charges"
on public.service_charges for insert
with check (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
       or lower(coalesce(a.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "admin can update service charges" on public.service_charges;
create policy "admin can update service charges"
on public.service_charges for update
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
       or lower(coalesce(a.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
       or lower(coalesce(a.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "admin can delete service charges" on public.service_charges;
create policy "admin can delete service charges"
on public.service_charges for delete
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
       or lower(coalesce(a.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

-- Keep the existing read behavior, but make admin recognition consistent.
drop policy if exists "users can read active service charges" on public.service_charges;
create policy "users can read active service charges"
on public.service_charges for select
using (
  is_active = true
  or exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
       or lower(coalesce(a.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  )
);
