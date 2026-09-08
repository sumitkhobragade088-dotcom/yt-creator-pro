-- YT Creator Pro — FINAL FIX
-- Fixes: infinite recursion detected in policy for relation "admin_staff_roles"
-- Run this ONE time in Supabase SQL Editor.
-- Do NOT re-run the old STAFF-DASHBOARDS-TOTAL-LOCK.sql policy section afterwards.

begin;

-- The old policy queried admin_staff_roles from inside its own policy:
--   exists(select 1 from public.admin_staff_roles ...)
-- PostgreSQL evaluates that policy again, causing infinite recursion.
--
-- Keep staff self-read, and allow the project's Super Admin by the
-- authenticated JWT email. This avoids querying admin_staff_roles from
-- its own RLS policy while preserving the existing Admin/Staff flow.

drop policy if exists "staff role self read" on public.admin_staff_roles;
drop policy if exists "staff role self or super admin read" on public.admin_staff_roles;

create policy "staff role self or super admin read"
on public.admin_staff_roles
for select
to authenticated
using (
  admin_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sumitkhobragade088@gmail.com')
);

-- Make the Super Admin check independent of the staff-role RLS policy too.
-- This prevents the same table from becoming part of a recursive authorization
-- chain when RPCs call yt_is_super_admin().
create or replace function public.yt_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sumitkhobragade088@gmail.com')
    and exists (
      select 1
      from public.admin_users u
      where u.id = auth.uid()
        and lower(coalesce(u.status, 'active')) = 'active'
    );
$$;

revoke all on function public.yt_is_super_admin() from public;
grant execute on function public.yt_is_super_admin() to authenticated;

authorize;

-- Verification: this must return the current user's row without recursion.
select id, role, status
from public.admin_staff_roles
where admin_id = auth.uid();

commit;
