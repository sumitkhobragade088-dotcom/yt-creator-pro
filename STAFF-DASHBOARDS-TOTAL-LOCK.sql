-- YT Creator Pro: Staff Dashboards / Status / Role Access TOTAL LOCK
-- Idempotent. Uses actual admin_users(id,email,created_at) schema.

alter table public.admin_users add column if not exists status text not null default 'active';
update public.admin_users set status='active' where status is null or trim(status)='';
alter table public.admin_users drop constraint if exists admin_users_status_check;
alter table public.admin_users add constraint admin_users_status_check check (lower(status) in ('active','inactive','suspended'));

create table if not exists public.admin_role_assignments (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null unique references public.admin_users(id) on delete cascade,
 role text not null check (role in ('super_admin','manager','operator','support')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

insert into public.admin_role_assignments(admin_user_id,role)
select id,'super_admin' from public.admin_users
where lower(email)=lower('sumitkhobragade088@gmail.com')
on conflict (admin_user_id) do update set role='super_admin',updated_at=now();

alter table public.admin_role_assignments enable row level security;
drop policy if exists "staff role read" on public.admin_role_assignments;
create policy "staff role read" on public.admin_role_assignments for select to authenticated using (admin_user_id=auth.uid() or exists(select 1 from public.admin_users where id=auth.uid() and lower(email)=lower('sumitkhobragade088@gmail.com')));
drop policy if exists "super admin role write" on public.admin_role_assignments;
create policy "super admin role write" on public.admin_role_assignments for all to authenticated using (exists(select 1 from public.admin_users where id=auth.uid() and lower(email)=lower('sumitkhobragade088@gmail.com'))) with check (exists(select 1 from public.admin_users where id=auth.uid() and lower(email)=lower('sumitkhobragade088@gmail.com')));

-- Verify after running:
-- select id,email,status from public.admin_users order by email;
-- select admin_user_id,role from public.admin_role_assignments order by role;
