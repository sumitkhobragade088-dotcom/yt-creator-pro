-- YT Creator Pro: additive Admin Control Suite
-- Features: 4 Application Workflow, 5 Roles/Permissions, 6 Audit Log,
-- 8 Revenue Reports, 10 Global Search, 11 Trash/Restore, 12 System Health.
-- Does not remove or rename existing tables/features.

create extension if not exists pgcrypto;

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
drop policy if exists "admin workflow history" on public.application_status_history;
create policy "admin workflow history" on public.application_status_history for all to authenticated
using (exists(select 1 from public.admin_users where id=auth.uid()))
with check (exists(select 1 from public.admin_users where id=auth.uid()));

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
drop trigger if exists trg_yt_record_application_status on public.service_requests;
create trigger trg_yt_record_application_status after insert or update of status on public.service_requests
for each row execute function public.yt_record_application_status();

-- ---------- 5) Roles and permissions ----------
create table if not exists public.admin_role_assignments(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null unique references public.admin_users(id) on delete cascade,
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
select r.role,p.permission_key from (values('super_admin'),('manager'),('operator'),('support')) r(role) cross join public.admin_permissions p
where (r.role='super_admin') or (r.role='manager' and p.permission_key not in('roles','trash')) or (r.role='operator' and p.permission_key in('applications','search','audit','health')) or (r.role='support' and p.permission_key in('applications','search','audit','health'))
on conflict do nothing;
insert into public.admin_role_assignments(admin_user_id,role)
select id,'super_admin' from public.admin_users where lower(email)='sumitkhobragade088@gmail.com' on conflict(admin_user_id) do nothing;
alter table public.admin_role_assignments enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
drop policy if exists "admin role assignments read" on public.admin_role_assignments;
create policy "admin role assignments read" on public.admin_role_assignments for select to authenticated using(exists(select 1 from public.admin_users where id=auth.uid()));
drop policy if exists "super admin role assignments write" on public.admin_role_assignments;
create policy "super admin role assignments write" on public.admin_role_assignments for all to authenticated using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com') with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "admin permissions read" on public.admin_permissions;
create policy "admin permissions read" on public.admin_permissions for select to authenticated using(exists(select 1 from public.admin_users where id=auth.uid()));
drop policy if exists "admin role permissions read" on public.admin_role_permissions;
create policy "admin role permissions read" on public.admin_role_permissions for select to authenticated using(exists(select 1 from public.admin_users where id=auth.uid()));
drop policy if exists "super admin role permissions write" on public.admin_role_permissions;
create policy "super admin role permissions write" on public.admin_role_permissions for all to authenticated using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com') with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

-- ---------- 6) Audit log ----------
create table if not exists public.activity_logs(
  id uuid primary key default gen_random_uuid(), actor_type text not null default 'system', actor_id uuid,
  customer_id uuid references public.customers(id) on delete set null, action text not null,
  target_type text, target_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
do $$ begin begin alter table public.activity_logs add column actor_id uuid; exception when duplicate_column then null; end; end $$;
alter table public.activity_logs enable row level security;
drop policy if exists "admin activity logs" on public.activity_logs;
create policy "admin activity logs" on public.activity_logs for all to authenticated using(exists(select 1 from public.admin_users where id=auth.uid())) with check(exists(select 1 from public.admin_users where id=auth.uid()));

create or replace function public.yt_audit_service_requests()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.activity_logs(actor_type,actor_id,customer_id,action,target_type,target_id,details)
  values('admin',auth.uid(),coalesce(new.customer_id,old.customer_id),case when tg_op='INSERT' then 'application_created' when old.status is distinct from new.status then 'application_status_changed' else 'application_updated' end,'service_requests',coalesce(new.id,old.id),jsonb_build_object('operation',tg_op,'old_status',case when tg_op='UPDATE' then old.status else null end,'new_status',new.status));
  return new;
end $$;
drop trigger if exists trg_yt_audit_service_requests on public.service_requests;
create trigger trg_yt_audit_service_requests after insert or update on public.service_requests for each row execute function public.yt_audit_service_requests();

-- ---------- 11) Trash / Restore ----------
create table if not exists public.admin_trash(
  id uuid primary key default gen_random_uuid(), table_name text not null, record_id uuid not null,
  snapshot jsonb not null, summary text not null default '', deleted_by uuid, deleted_at timestamptz not null default now(),
  restored_at timestamptz, restored_by uuid
);
alter table public.admin_trash enable row level security;
drop policy if exists "admin trash access" on public.admin_trash;
create policy "admin trash access" on public.admin_trash for all to authenticated using(exists(select 1 from public.admin_users where id=auth.uid())) with check(exists(select 1 from public.admin_users where id=auth.uid()));

-- Soft-delete columns are additive. Payments/transactions are intentionally excluded.
create table if not exists public.service_catalog(
  id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '',
  price numeric(12,2) not null default 0 check(price>=0), is_active boolean not null default true, sort_order integer not null default 100,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ begin
  begin alter table public.customers add column is_deleted boolean not null default false; exception when duplicate_column then null; end;
  begin alter table public.customers add column deleted_at timestamptz; exception when duplicate_column then null; end;
  begin alter table public.service_requests add column is_deleted boolean not null default false; exception when duplicate_column then null; end;
  begin alter table public.service_requests add column deleted_at timestamptz; exception when duplicate_column then null; end;
  begin alter table public.service_catalog add column is_deleted boolean not null default false; exception when duplicate_column then null; end;
  begin alter table public.service_catalog add column deleted_at timestamptz; exception when duplicate_column then null; end;
end $$;

create or replace function public.admin_soft_delete_record(p_table text,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; summary text;
begin
  if not exists(select 1 from public.admin_users where id=auth.uid()) then raise exception 'Not authorized'; end if;
  if p_table not in('customers','service_requests','service_catalog') then raise exception 'Table is not eligible for trash'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id=$1',p_table) into r using p_id;
  if r is null then raise exception 'Record not found'; end if;
  summary:=coalesce(r->>'name',r->>'full_name',r->>'service_type',r->>'email',p_id::text);
  insert into public.admin_trash(table_name,record_id,snapshot,summary,deleted_by) values(p_table,p_id,r,summary,auth.uid());
  execute format('update public.%I set is_deleted=true,deleted_at=now() where id=$1',p_table) using p_id;
  return jsonb_build_object('ok',true,'table',p_table,'id',p_id);
end $$;

create or replace function public.admin_restore_record(p_trash_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.admin_trash%rowtype;
begin
  if not exists(select 1 from public.admin_users where id=auth.uid()) then raise exception 'Not authorized'; end if;
  select * into t from public.admin_trash where id=p_trash_id and restored_at is null;
  if not found then raise exception 'Trash record not found'; end if;
  if t.table_name not in('customers','service_requests','service_catalog') then raise exception 'Record cannot be restored'; end if;
  execute format('update public.%I set is_deleted=false,deleted_at=null where id=$1',t.table_name) using t.record_id;
  update public.admin_trash set restored_at=now(),restored_by=auth.uid() where id=p_trash_id;
  return jsonb_build_object('ok',true);
end $$;

-- ---------- 10) Global search ----------
create or replace function public.admin_global_search(p_term text,p_limit integer default 50)
returns table(record_type text,record_id uuid,title text,detail text)
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.admin_users where id=auth.uid()) then raise exception 'Not authorized'; end if;
  return query
  select 'user'::text,c.id,coalesce(c.full_name,c.email,'User'),coalesce(c.email,'')||' '||coalesce(c.mobile,'') from public.customers c
  where not coalesce(c.is_deleted,false) and (c.full_name ilike '%'||p_term||'%' or c.email ilike '%'||p_term||'%' or c.mobile ilike '%'||p_term||'%')
  union all
  select 'application'::text,r.id,coalesce(r.service_type,'Application'),coalesce(r.status,'') from public.service_requests r
  where not coalesce(r.is_deleted,false) and (r.service_type ilike '%'||p_term||'%' or r.status ilike '%'||p_term||'%')
  union all
  select 'payment'::text,p.id,coalesce(p.service_name,'Payment'),coalesce(p.status,'')||' '||coalesce(p.txnid,'') from public.payments p
  where p.service_name ilike '%'||p_term||'%' or p.status ilike '%'||p_term||'%' or p.txnid ilike '%'||p_term||'%'
  union all
  select 'service'::text,s.id,s.name,s.description from public.service_catalog s
  where not coalesce(s.is_deleted,false) and (s.name ilike '%'||p_term||'%' or s.description ilike '%'||p_term||'%')
  limit greatest(1,least(p_limit,200));
end $$;

-- ---------- 8) Revenue report ----------
create or replace function public.admin_revenue_report(p_from timestamptz default null,p_to timestamptz default null)
returns table(total_revenue numeric,successful_count bigint,pending_count bigint,failed_count bigint)
language sql security definer set search_path=public as $$
  select coalesce(sum(case when lower(status) in('success','successful','paid','completed') then amount else 0 end),0),
         count(*) filter(where lower(status) in('success','successful','paid','completed')),
         count(*) filter(where lower(status)='pending'),
         count(*) filter(where lower(status) in('failed','failure','cancelled'))
  from public.payments
  where (p_from is null or created_at>=p_from) and (p_to is null or created_at<=p_to)
$$;

-- ---------- 12) System health ----------
create or replace function public.admin_system_health()
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object('database','healthy','checked_at',now(),'tables',jsonb_build_object(
 'customers',to_regclass('public.customers') is not null,
 'service_requests',to_regclass('public.service_requests') is not null,
 'payments',to_regclass('public.payments') is not null,
 'cms',to_regclass('public.yt_cms_settings') is not null,
 'workflow',to_regclass('public.application_status_history') is not null,
 'audit',to_regclass('public.activity_logs') is not null,
 'trash',to_regclass('public.admin_trash') is not null
));
$$;

create index if not exists application_status_history_request_idx on public.application_status_history(request_id,changed_at desc);
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists admin_trash_deleted_idx on public.admin_trash(deleted_at desc);
