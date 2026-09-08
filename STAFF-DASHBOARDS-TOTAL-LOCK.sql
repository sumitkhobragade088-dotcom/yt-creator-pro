-- YT Creator Pro — STAFF DASHBOARDS TOTAL LOCK
-- Run once in Supabase SQL Editor.
-- Uses the project's actual admin_users.id schema.
create extension if not exists pgcrypto;

create table if not exists public.admin_staff_roles(
  admin_id uuid primary key references public.admin_users(id) on delete cascade,
  role text not null check(role in('super_admin','manager','operator','support')),
  status text not null default 'active' check(status in('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_staff_profiles(
  admin_id uuid primary key references public.admin_users(id) on delete cascade,
  full_name text not null default '',
  invited_email text not null,
  invite_status text not null default 'active',
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep any previously-created role assignments in sync.
insert into public.admin_staff_roles(admin_id,role,status,created_at,updated_at)
select a.admin_user_id,a.role,'active',coalesce(a.created_at,now()),coalesce(a.updated_at,now())
from public.admin_role_assignments a
on conflict(admin_id) do update set role=excluded.role,updated_at=excluded.updated_at;

-- Protect the existing Super Admin account and ensure it has a staff-role row.
insert into public.admin_staff_roles(admin_id,role,status)
select id,'super_admin','active' from public.admin_users
where lower(email)=lower('sumitkhobragade088@gmail.com')
on conflict(admin_id) do update set role='super_admin',status='active',updated_at=now();

-- Ensure the permission catalog contains all current staff-dashboard modules.
insert into public.admin_permissions(permission_key,label) values
('dashboard.view','Dashboard'),
('applications.view','Applications — View'),('applications.update','Applications — Update'),('applications.delete','Applications — Delete'),('applications.delete_all','Applications — Delete All'),
('users','Users'),('services.view','Services — View'),('services.manage','Services — Manage'),
('payments','Payments'),('revenue.view','Revenue — View'),('revenue.delete','Revenue — Delete'),('revenue.delete_all','Revenue — Delete All'),
('youtube','YouTube'),('website_cms.view','Website CMS — View'),('website_cms.manage','Website CMS — Manage'),
('audit.view','Audit Log — View'),('audit.delete','Audit Log — Delete'),('audit.delete_all','Audit Log — Delete All'),
('trash.view','Trash — View'),('trash.restore','Trash — Restore'),('trash.permanent_delete','Trash — Permanent Delete'),('trash.empty','Trash — Empty'),
('system_health.view','System Health'),('global_search.use','Global Search'),
('roles.view','Roles — View'),('roles.manage','Roles — Manage'),('roles.assign','Roles — Assign'),('staff.manage','Staff — Manage'),('staff.create','Staff — Create'),('staff.suspend','Staff — Suspend')
on conflict(permission_key) do update set label=excluded.label;

-- Safe read policy for active authenticated admin/staff.
alter table public.admin_staff_roles enable row level security;
drop policy if exists "staff role self read" on public.admin_staff_roles;
create policy "staff role self read" on public.admin_staff_roles for select to authenticated
using(admin_id=auth.uid() or exists(select 1 from public.admin_staff_roles s where s.admin_id=auth.uid() and s.role='super_admin' and s.status='active'));

-- Permission reads are already protected by the existing Admin Control Suite policy.
-- These RPCs are the only write path used by the Admin UI for staff status/role/delete.
create or replace function public.yt_is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.admin_users u join public.admin_staff_roles s on s.admin_id=u.id where u.id=auth.uid() and s.role='super_admin' and s.status='active');
$$;

create or replace function public.admin_update_staff(p_admin_id uuid,p_role text,p_status text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can manage staff'; end if;
  if p_admin_id=auth.uid() then raise exception 'Your Super Admin account is protected'; end if;
  if p_role not in('manager','operator','support') then raise exception 'Invalid staff role'; end if;
  if p_status not in('active','inactive','suspended') then raise exception 'Invalid staff status'; end if;
  update public.admin_staff_roles set role=p_role,status=p_status,updated_at=now() where admin_id=p_admin_id;
  if not found then raise exception 'Staff role record not found'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_remove_staff(p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete staff access'; end if;
  if p_admin_id=auth.uid() then raise exception 'Your Super Admin account cannot be deleted'; end if;
  delete from public.admin_staff_profiles where admin_id=p_admin_id;
  delete from public.admin_staff_roles where admin_id=p_admin_id;
  delete from public.admin_users where id=p_admin_id;
  return jsonb_build_object('ok',true,'auth_user_deleted',false);
end $$;
revoke all on function public.admin_update_staff(uuid,text,text) from public;
revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_update_staff(uuid,text,text) to authenticated;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
