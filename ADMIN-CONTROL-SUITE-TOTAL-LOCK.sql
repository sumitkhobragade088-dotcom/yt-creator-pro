-- YT Creator Pro Admin Control Suite TOTAL LOCK
-- Features: Application workflow, Roles/Permissions, Audit Log, Revenue reports,
-- Global Search, Trash/Restore, System Health.
-- IMPORTANT: This migration matches the project's actual admin_users schema:
-- public.admin_users(user_id uuid). It does NOT assume id/email columns on admin_users.

create extension if not exists pgcrypto;

-- ---------- Admin helpers ----------
create or replace function public.yt_is_super_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
    and exists(select 1 from public.admin_users a where a.user_id=auth.uid());
$$;

create or replace function public.yt_is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.admin_users a where a.user_id=auth.uid());
$$;

-- ---------- 4) Application workflow ----------
create table if not exists public.application_status_history(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  old_status text,
  new_status text not null,
  note text not null default '',
  changed_by uuid,
  changed_at timestamptz not null default now()
);
alter table public.application_status_history enable row level security;
drop policy if exists "acs workflow admin" on public.application_status_history;
create policy "acs workflow admin" on public.application_status_history
for all to authenticated using(public.yt_is_admin()) with check(public.yt_is_admin());

create or replace function public.yt_record_application_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.application_status_history(request_id,new_status,note,changed_by)
    values(new.id,coalesce(new.status,'pending'),'Application created',auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.application_status_history(request_id,old_status,new_status,note,changed_by)
    values(new.id,old.status,new.status,'Status changed',auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists trg_acs_record_application_status on public.service_requests;
create trigger trg_acs_record_application_status after insert or update of status on public.service_requests
for each row execute function public.yt_record_application_status();

create or replace function public.admin_application_history(p_request_id uuid)
returns table(old_status text,new_status text,note text,changed_at timestamptz)
language sql security definer set search_path=public
as $$ select h.old_status,h.new_status,h.note,h.changed_at from public.application_status_history h
where h.request_id=p_request_id order by h.changed_at desc limit 200 $$;

-- ---------- 5) Roles and permissions ----------
create table if not exists public.admin_role_assignments(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null unique references public.admin_users(user_id) on delete cascade,
  role text not null default 'operator' check(role in('super_admin','manager','operator','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_permissions(
  permission_key text primary key,
  label text not null
);
create table if not exists public.admin_role_permissions(
  role text not null check(role in('super_admin','manager','operator','support')),
  permission_key text not null references public.admin_permissions(permission_key) on delete cascade,
  primary key(role,permission_key)
);
insert into public.admin_permissions(permission_key,label) values
('applications','Applications / Workflow'),('roles','Roles & Permissions'),('audit','Activity / Audit Log'),
('revenue','Revenue & Payment Reports'),('search','Global Search'),('trash','Trash / Restore'),('health','System Health'),
('services','Services'),('cms','CMS'),('users','Users'),('youtube','YouTube'),('payments','Payments')
on conflict(permission_key) do update set label=excluded.label;

insert into public.admin_role_permissions(role,permission_key)
select r.role,p.permission_key from (values('super_admin'),('manager'),('operator'),('support')) r(role)
cross join public.admin_permissions p
where (r.role='super_admin')
or (r.role='manager' and p.permission_key in('applications','revenue','search','health','services','cms','users','youtube','payments'))
or (r.role='operator' and p.permission_key in('applications','search','health','users'))
or (r.role='support' and p.permission_key in('applications','search','users'))
on conflict do nothing;

insert into public.admin_role_assignments(admin_user_id,role)
select a.user_id,'super_admin' from public.admin_users a
join auth.users u on u.id=a.user_id
where lower(u.email)='sumitkhobragade088@gmail.com'
on conflict(admin_user_id) do update set role='super_admin',updated_at=now();

alter table public.admin_role_assignments enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
drop policy if exists "acs role assignments read" on public.admin_role_assignments;
create policy "acs role assignments read" on public.admin_role_assignments for select to authenticated using(public.yt_is_admin());
drop policy if exists "acs role assignments write" on public.admin_role_assignments;
create policy "acs role assignments write" on public.admin_role_assignments for all to authenticated using(public.yt_is_super_admin()) with check(public.yt_is_super_admin());
drop policy if exists "acs permissions read" on public.admin_permissions;
create policy "acs permissions read" on public.admin_permissions for select to authenticated using(public.yt_is_admin());
drop policy if exists "acs role permissions read" on public.admin_role_permissions;
create policy "acs role permissions read" on public.admin_role_permissions for select to authenticated using(public.yt_is_admin());
drop policy if exists "acs role permissions write" on public.admin_role_permissions;
create policy "acs role permissions write" on public.admin_role_permissions for all to authenticated using(public.yt_is_super_admin()) with check(public.yt_is_super_admin());

create or replace function public.admin_list_role_assignments()
returns table(assignment_id uuid,user_id uuid,email text,role text,created_at timestamptz)
language sql security definer set search_path=public
as $$
  select a.id,a.admin_user_id,u.email,a.role,a.created_at
  from public.admin_role_assignments a join auth.users u on u.id=a.admin_user_id
  where public.yt_is_super_admin()
  order by a.created_at;
$$;

create or replace function public.admin_get_role_permissions()
returns table(role text,permission_key text)
language sql security definer set search_path=public
as $$ select role,permission_key from public.admin_role_permissions order by role,permission_key $$;

create or replace function public.admin_assign_role(p_user_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can assign roles'; end if;
  if not exists(select 1 from public.admin_users where user_id=p_user_id) then raise exception 'Account is not an authorized admin/staff account'; end if;
  if p_role not in('super_admin','manager','operator','support') then raise exception 'Invalid role'; end if;
  insert into public.admin_role_assignments(admin_user_id,role) values(p_user_id,p_role)
  on conflict(admin_user_id) do update set role=excluded.role,updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_set_role(p_assignment_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can change roles'; end if;
  if p_role not in('super_admin','manager','operator','support') then raise exception 'Invalid role'; end if;
  update public.admin_role_assignments set role=p_role,updated_at=now() where id=p_assignment_id;
  if not found then raise exception 'Role assignment not found'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_remove_role_assignment(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can remove roles'; end if;
  if exists(select 1 from public.admin_role_assignments where id=p_assignment_id and role='super_admin') then
    raise exception 'Super Admin assignment cannot be removed here';
  end if;
  delete from public.admin_role_assignments where id=p_assignment_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_set_role_permission(p_role text,p_permission_key text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can change permissions'; end if;
  if p_enabled then
    insert into public.admin_role_permissions(role,permission_key) values(p_role,p_permission_key) on conflict do nothing;
  else
    delete from public.admin_role_permissions where role=p_role and permission_key=p_permission_key;
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- ---------- 6) Audit log ----------
create table if not exists public.activity_logs(
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;
drop policy if exists "acs audit admin" on public.activity_logs;
create policy "acs audit admin" on public.activity_logs for all to authenticated using(public.yt_is_admin()) with check(public.yt_is_admin());

create or replace function public.admin_write_audit(p_action text,p_target_type text default null,p_target_id uuid default null,p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.yt_is_admin() then raise exception 'Not authorized'; end if;
  insert into public.activity_logs(actor_type,actor_id,action,target_type,target_id,details)
  values('admin',auth.uid(),p_action,p_target_type,p_target_id,coalesce(p_details,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_delete_audit(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete audit logs'; end if;
  delete from public.activity_logs where id=p_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_delete_all_audit()
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete audit logs'; end if;
  delete from public.activity_logs;
  get diagnostics n=row_count;
  return n;
end $$;

-- ---------- 11) Trash / Restore ----------
create table if not exists public.admin_trash(
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  snapshot jsonb not null,
  summary text not null default '',
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid
);
alter table public.admin_trash enable row level security;
drop policy if exists "acs trash admin" on public.admin_trash;
create policy "acs trash admin" on public.admin_trash for all to authenticated using(public.yt_is_admin()) with check(public.yt_is_admin());

do $$ begin
  begin alter table public.customers add column is_deleted boolean not null default false; exception when duplicate_column then null; end;
  begin alter table public.customers add column deleted_at timestamptz; exception when duplicate_column then null; end;
  begin alter table public.service_requests add column is_deleted boolean not null default false; exception when duplicate_column then null; end;
  begin alter table public.service_requests add column deleted_at timestamptz; exception when duplicate_column then null; end;
end $$;

create or replace function public.admin_soft_delete_record(p_table text,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; summary text;
begin
  if not public.yt_is_admin() then raise exception 'Not authorized'; end if;
  if p_table not in('customers','service_requests') then raise exception 'Table is not eligible for Trash'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id=$1 and coalesce(t.is_deleted,false)=false',p_table) into r using p_id;
  if r is null then raise exception 'Record not found'; end if;
  summary:=coalesce(r->>'name',r->>'full_name',r->>'service_type',r->>'service_name',r->>'email',p_id::text);
  insert into public.admin_trash(table_name,record_id,snapshot,summary,deleted_by) values(p_table,p_id,r,summary,auth.uid());
  execute format('update public.%I set is_deleted=true,deleted_at=now() where id=$1',p_table) using p_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_soft_delete_all(p_table text)
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete all'; end if;
  if p_table not in('service_requests') then raise exception 'Bulk delete is restricted'; end if;
  execute format('insert into public.admin_trash(table_name,record_id,snapshot,summary,deleted_by)
                  select %L,id,to_jsonb(t),coalesce(t.service_type,t.service_name,t.id::text),auth.uid()
                  from public.%I t where coalesce(t.is_deleted,false)=false',p_table,p_table);
  get diagnostics n=row_count;
  execute format('update public.%I set is_deleted=true,deleted_at=now() where coalesce(is_deleted,false)=false',p_table);
  return n;
end $$;

create or replace function public.admin_list_trash()
returns table(id uuid,table_name text,record_id uuid,summary text,deleted_at timestamptz)
language sql security definer set search_path=public
as $$ select t.id,t.table_name,t.record_id,t.summary,t.deleted_at from public.admin_trash t where t.restored_at is null order by t.deleted_at desc limit 500 $$;

create or replace function public.admin_restore_record(p_trash_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.admin_trash%rowtype;
begin
  if not public.yt_is_admin() then raise exception 'Not authorized'; end if;
  select * into t from public.admin_trash where id=p_trash_id and restored_at is null;
  if not found then raise exception 'Trash record not found'; end if;
  if t.table_name not in('customers','service_requests') then raise exception 'Record cannot be restored'; end if;
  execute format('update public.%I set is_deleted=false,deleted_at=null where id=$1',t.table_name) using t.record_id;
  update public.admin_trash set restored_at=now(),restored_by=auth.uid() where id=p_trash_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_permanent_delete_trash(p_trash_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.admin_trash%rowtype;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can permanently delete'; end if;
  select * into t from public.admin_trash where id=p_trash_id and restored_at is null;
  if not found then raise exception 'Trash record not found'; end if;
  -- Applications may cascade to related data (including payments). Confirmation is required in UI.
  if t.table_name not in('customers','service_requests') then raise exception 'Record cannot be permanently deleted'; end if;
  execute format('delete from public.%I where id=$1',t.table_name) using t.record_id;
  delete from public.admin_trash where id=p_trash_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_empty_trash()
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint; t record;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can empty Trash'; end if;
  for t in select * from public.admin_trash where restored_at is null loop
    if t.table_name in('customers','service_requests') then
      execute format('delete from public.%I where id=$1',t.table_name) using t.record_id;
    end if;
    delete from public.admin_trash where id=t.id;
  end loop;
  get diagnostics n=row_count;
  return n;
end $$;

-- ---------- 8) Revenue: archive from report, preserve payment ledger ----------
create table if not exists public.admin_payment_archive(
  payment_id uuid primary key references public.payments(id) on delete cascade,
  archived_by uuid,
  archived_at timestamptz not null default now()
);
alter table public.admin_payment_archive enable row level security;
drop policy if exists "acs payment archive admin" on public.admin_payment_archive;
create policy "acs payment archive admin" on public.admin_payment_archive for all to authenticated using(public.yt_is_admin()) with check(public.yt_is_admin());

create or replace function public.admin_archive_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete revenue records from the report'; end if;
  insert into public.admin_payment_archive(payment_id,archived_by) values(p_payment_id,auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_archive_all_payments()
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete revenue records from the report'; end if;
  insert into public.admin_payment_archive(payment_id,archived_by)
  select p.id,auth.uid() from public.payments p
  left join public.admin_payment_archive a on a.payment_id=p.id
  where a.payment_id is null;
  get diagnostics n=row_count;
  return n;
end $$;

create or replace function public.admin_get_archived_payments()
returns table(payment_id uuid)
language sql security definer set search_path=public
as $$ select payment_id from public.admin_payment_archive $$;

-- ---------- 10) Global Search ----------
create or replace function public.admin_global_search(p_term text,p_limit integer default 100)
returns table(record_type text,record_id uuid,title text,detail text,url text)
language plpgsql security definer set search_path=public as $$
declare q text:=trim(coalesce(p_term,''));
begin
  if not public.yt_is_admin() then raise exception 'Not authorized'; end if;
  if q='' then return; end if;
  return query
  select 'user',c.id,coalesce(c.full_name,c.email,'User'),coalesce(c.email,'')||' '||coalesce(c.mobile,''),'customers' from public.customers c
    where not coalesce(c.is_deleted,false) and (c.full_name ilike '%'||q||'%' or c.email ilike '%'||q||'%' or c.mobile ilike '%'||q||'%')
  union all
  select 'application',r.id,coalesce(r.service_type,r.service_name,'Application'),coalesce(r.status,''),'service_requests' from public.service_requests r
    where not coalesce(r.is_deleted,false) and (r.service_type ilike '%'||q||'%' or r.service_name ilike '%'||q||'%' or r.status ilike '%'||q||'%')
  union all
  select 'payment',p.id,coalesce(p.service_name,'Payment'),coalesce(p.status,'')||' '||coalesce(p.txnid,''),'payments' from public.payments p
    where p.service_name ilike '%'||q||'%' or p.status ilike '%'||q||'%' or p.txnid ilike '%'||q||'%'
  limit greatest(1,least(p_limit,200));
end $$;

-- ---------- 12) System Health ----------
create or replace function public.admin_system_health()
returns jsonb language sql security definer set search_path=public
as $$ select jsonb_build_object(
  'database',to_regclass('public.customers') is not null,
  'applications',to_regclass('public.service_requests') is not null,
  'payments',to_regclass('public.payments') is not null,
  'workflow',to_regclass('public.application_status_history') is not null,
  'audit',to_regclass('public.activity_logs') is not null,
  'trash',to_regclass('public.admin_trash') is not null,
  'checked_at',now()
) $$;

create index if not exists acs_application_status_history_idx on public.application_status_history(request_id,changed_at desc);
create index if not exists acs_activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists acs_trash_deleted_idx on public.admin_trash(deleted_at desc);
create index if not exists acs_payment_archive_idx on public.admin_payment_archive(archived_at desc);
