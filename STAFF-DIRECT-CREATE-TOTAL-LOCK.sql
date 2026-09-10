-- YT Creator Pro — Direct Staff Create / Activity / Delete
-- Uses the project's actual admin_users(id,email,created_at) schema.
-- Does NOT delete Supabase Auth users when removing admin staff access.

create extension if not exists pgcrypto;

create table if not exists public.admin_staff_profiles(
  admin_id uuid primary key references public.admin_users(id) on delete cascade,
  full_name text not null default '',
  invited_email text not null,
  invite_status text not null default 'active' check(invite_status in('invited','active','disabled')),
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing project migration created this table with admin_id/role/status.
create table if not exists public.admin_staff_roles(
  admin_id uuid primary key references public.admin_users(id) on delete cascade,
  role text not null check(role in('super_admin','manager','operator','support')),
  status text not null default 'active' check(status in('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.yt_is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.admin_users u
    join public.admin_staff_roles s on s.admin_id=u.id
    where u.id=auth.uid() and s.role='super_admin' and s.status='active'
  );
$$;

create or replace function public.yt_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.admin_users u
    left join public.admin_staff_roles s on s.admin_id=u.id
    where u.id=auth.uid() and coalesce(s.status,'active')='active'
  );
$$;

create or replace function public.admin_staff_list()
returns table(admin_id uuid,email text,full_name text,role text,status text,created_at timestamptz,updated_at timestamptz)
language sql security definer set search_path=public as $$
  select u.id,u.email,coalesce(p.full_name,''),coalesce(s.role,'operator'),coalesce(s.status,'active'),u.created_at,coalesce(s.updated_at,u.created_at)
  from public.admin_users u
  left join public.admin_staff_roles s on s.admin_id=u.id
  left join public.admin_staff_profiles p on p.admin_id=u.id
  where public.yt_is_super_admin()
  order by u.created_at desc;
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
  update public.admin_staff_profiles set invite_status=case when p_status='active' then 'active' else 'disabled' end,updated_at=now() where admin_id=p_admin_id;
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

revoke all on function public.admin_staff_list() from public;
revoke all on function public.admin_update_staff(uuid,text,text) from public;
revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_staff_list() to authenticated;
grant execute on function public.admin_update_staff(uuid,text,text) to authenticated;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
