-- YT Creator Pro — Admin Control Suite FIX
-- Run this once in Supabase SQL Editor after the related JS patch.
-- Existing data is preserved.

create extension if not exists pgcrypto;

-- Application bulk delete -> Trash
create or replace function public.admin_soft_delete_all(p_table text)
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete all'; end if;
  if p_table <> 'service_requests' then raise exception 'Bulk delete is restricted'; end if;
  execute format('insert into public.admin_trash(table_name,record_id,snapshot,summary,deleted_by)
                  select %L,id,to_jsonb(t),coalesce(t.service_type,t.service_name,t.id::text),auth.uid()
                  from public.%I t where coalesce(t.is_deleted,false)=false',p_table,p_table);
  get diagnostics n=row_count;
  execute format('update public.%I set is_deleted=true,deleted_at=now() where coalesce(is_deleted,false)=false',p_table);
  return n;
end $$;

-- Audit log single/all delete
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

-- Revenue delete is an archive from the Revenue report; original payments stay intact.
create or replace function public.admin_archive_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete revenue records from the report'; end if;
  insert into public.admin_payment_archive(payment_id,archived_by)
  values(p_payment_id,auth.uid()) on conflict do nothing;
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

-- Trash list / restore / permanent delete / empty
create or replace function public.admin_list_trash()
returns table(id uuid,table_name text,record_id uuid,summary text,deleted_at timestamptz)
language sql security definer set search_path=public
as $$
  select t.id,t.table_name,t.record_id,t.summary,t.deleted_at
  from public.admin_trash t
  where t.restored_at is null
  order by t.deleted_at desc limit 500
$$;

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
  if t.table_name not in('customers','service_requests') then raise exception 'Record cannot be permanently deleted'; end if;
  execute format('delete from public.%I where id=$1',t.table_name) using t.record_id;
  delete from public.admin_trash where id=p_trash_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_empty_trash()
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint; t record; deleted_count bigint:=0;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can empty Trash'; end if;
  for t in select * from public.admin_trash where restored_at is null loop
    if t.table_name in('customers','service_requests') then
      execute format('delete from public.%I where id=$1',t.table_name) using t.record_id;
    end if;
    delete from public.admin_trash where id=t.id;
    deleted_count:=deleted_count+1;
  end loop;
  n:=deleted_count;
  return n;
end $$;

-- Global Search: users + applications + services + payments, including UUID/transaction IDs.
create or replace function public.admin_global_search(p_term text,p_limit integer default 100)
returns table(record_type text,record_id uuid,title text,detail text,url text)
language plpgsql security definer set search_path=public as $$
declare q text:=trim(coalesce(p_term,'')); lim integer:=greatest(1,least(coalesce(p_limit,100),200));
begin
  if not public.yt_is_admin() then raise exception 'Not authorized'; end if;
  if q='' then return; end if;
  return query
  select 'user'::text,c.id,coalesce(c.full_name,c.email,'User')::text,
         concat_ws(' ',c.email,c.mobile)::text,'customers'::text
    from public.customers c
   where not coalesce(c.is_deleted,false)
     and (c.full_name ilike '%'||q||'%' or c.email ilike '%'||q||'%' or c.mobile ilike '%'||q||'%' or c.id::text ilike '%'||q||'%')
  union all
  select 'application'::text,r.id,coalesce(r.service_type,r.service_name,'Application')::text,
         concat_ws(' ',r.status,r.service_type,r.service_name)::text,'service_requests'::text
    from public.service_requests r
   where not coalesce(r.is_deleted,false)
     and (r.service_type ilike '%'||q||'%' or r.service_name ilike '%'||q||'%' or r.status ilike '%'||q||'%' or r.id::text ilike '%'||q||'%')
  union all
  select 'service'::text,s.id,s.name::text,coalesce(s.description,'')::text,'services'::text
    from public.service_catalog s
   where not coalesce(s.is_deleted,false)
     and (s.name ilike '%'||q||'%' or coalesce(s.description,'') ilike '%'||q||'%' or s.id::text ilike '%'||q||'%')
  union all
  select 'payment'::text,p.id,coalesce(p.service_name,'Payment')::text,
         concat_ws(' ',p.status,p.txnid)::text,'payments'::text
    from public.payments p
   where p.service_name ilike '%'||q||'%' or p.status ilike '%'||q||'%' or p.txnid ilike '%'||q||'%' or p.id::text ilike '%'||q||'%'
  limit lim;
end $$;

-- System Health: one fast RPC used by the UI instead of several independent calls.
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

grant execute on function public.admin_soft_delete_all(text) to authenticated;
grant execute on function public.admin_delete_audit(uuid) to authenticated;
grant execute on function public.admin_delete_all_audit() to authenticated;
grant execute on function public.admin_archive_payment(uuid) to authenticated;
grant execute on function public.admin_archive_all_payments() to authenticated;
grant execute on function public.admin_get_archived_payments() to authenticated;
grant execute on function public.admin_list_trash() to authenticated;
grant execute on function public.admin_restore_record(uuid) to authenticated;
grant execute on function public.admin_permanent_delete_trash(uuid) to authenticated;
grant execute on function public.admin_empty_trash() to authenticated;
grant execute on function public.admin_global_search(text,integer) to authenticated;
grant execute on function public.admin_system_health() to authenticated;
