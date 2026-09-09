-- YT Creator Pro — NORMAL USER -> CUSTOMER -> SERVICE -> ADMIN FLOW FINAL FIX
-- Run this SQL once in Supabase SQL Editor.
-- Does NOT delete or modify existing normal-user data.
-- Admin/staff accounts are excluded from the normal Users/Customers list.

-- 1) Normal authenticated users may create/read/update only their own customer profile.
alter table public.customers enable row level security;

drop policy if exists "customer can create own profile" on public.customers;
create policy "customer can create own profile"
on public.customers for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "customer can read own profile" on public.customers;
create policy "customer can read own profile"
on public.customers for select to authenticated
using (user_id = auth.uid());

drop policy if exists "customer can update own profile" on public.customers;
create policy "customer can update own profile"
on public.customers for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 2) Secure Admin RPC: return only normal website customers.
-- It deliberately excludes users present in admin_users/admin_staff_roles and
-- excludes the Super Admin email. This prevents Admin/Staff IDs from appearing
-- in Users / Customers while keeping all normal users visible to Super Admin.
create or replace function public.admin_list_normal_customers()
returns table(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  mobile text,
  channel_name text,
  channel_url text,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    c.id,
    c.user_id,
    c.full_name,
    c.email,
    c.mobile,
    c.channel_name,
    c.channel_url,
    c.created_at
  from public.customers c
  where coalesce(c.is_deleted,false)=false
    and lower(coalesce(c.email,'')) <> 'sumitkhobragade088@gmail.com'
    and not exists (
      select 1 from public.admin_users a where a.user_id = c.user_id
    )
    and not exists (
      select 1 from public.admin_staff_roles s where s.admin_id = c.user_id
    )
  order by c.created_at desc;
$$;

revoke all on function public.admin_list_normal_customers() from public;
grant execute on function public.admin_list_normal_customers() to authenticated;

-- 3) One-time safe backfill for normal Auth users whose customer profile is missing.
-- Existing rows are left untouched. Admin/staff accounts are never inserted.
do $$
declare
  u record;
begin
  for u in
    select
      au.id,
      au.email,
      au.raw_user_meta_data
    from auth.users au
    where lower(coalesce(au.email,'')) <> 'sumitkhobragade088@gmail.com'
      and not exists (select 1 from public.admin_users a where a.user_id=au.id)
      and not exists (select 1 from public.admin_staff_roles s where s.admin_id=au.id)
      and not exists (select 1 from public.customers c where c.user_id=au.id)
  loop
    insert into public.customers(
      user_id, full_name, email, mobile, channel_name, channel_url
    ) values (
      u.id,
      coalesce(u.raw_user_meta_data->>'full_name',''),
      coalesce(u.email,''),
      coalesce(u.raw_user_meta_data->>'mobile',''),
      coalesce(u.raw_user_meta_data->>'channel_name',''),
      coalesce(u.raw_user_meta_data->>'channel_url','')
    );
  end loop;
end $$;

-- 4) Verification: this should show every normal website user and zero Admin/Staff users.
select id,user_id,full_name,email,mobile,channel_name,created_at
from public.admin_list_normal_customers();
