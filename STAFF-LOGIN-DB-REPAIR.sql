-- STAFF / ADMIN LOGIN REPAIR
-- Actual project schema seen in Supabase uses public.admin_users(id,email).
-- This migration keeps that schema and adds staff status safely.

create extension if not exists pgcrypto;

alter table public.admin_users
  add column if not exists status text not null default 'active';

-- Normalize old/null values.
update public.admin_users
set status='active'
where status is null or lower(status) not in ('active','inactive','suspended');

-- Role table must point to admin_users.id in this installation.
create table if not exists public.admin_role_assignments(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null unique references public.admin_users(id) on delete cascade,
  role text not null default 'operator' check(role in('super_admin','manager','operator','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Make the known primary admin Super Admin.
insert into public.admin_role_assignments(admin_user_id,role)
select a.id,'super_admin'
from public.admin_users a
where lower(coalesce(a.email,''))='sumitkhobragade088@gmail.com'
on conflict(admin_user_id) do update set role='super_admin',updated_at=now();

-- IMPORTANT FOR AN EXISTING STAFF ACCOUNT:
-- Replace STAFF_EMAIL below with the staff account's Auth email and run this.
-- It creates the admin/staff authorization row using auth.users.id.
-- Do NOT add normal users to this table.
--
-- insert into public.admin_users(id,email,status)
-- select u.id,u.email,'active'
-- from auth.users u
-- where lower(u.email)=lower('STAFF_EMAIL')
-- on conflict(id) do update set email=excluded.email;
--
-- Then assign the required role:
-- insert into public.admin_role_assignments(admin_user_id,role)
-- select a.id,'operator' from public.admin_users a
-- where lower(a.email)=lower('STAFF_EMAIL')
-- on conflict(admin_user_id) do update set role=excluded.role,updated_at=now();

-- Status examples for an existing staff account:
-- update public.admin_users set status='active' where lower(email)=lower('STAFF_EMAIL');
-- update public.admin_users set status='inactive' where lower(email)=lower('STAFF_EMAIL');
-- update public.admin_users set status='suspended' where lower(email)=lower('STAFF_EMAIL');
