-- ADMIN HISTORY: separate operational history from Audit Log.
-- Delete History never deletes activity_logs, customers, applications or payments.

create table if not exists public.admin_history(
  id uuid primary key default gen_random_uuid(),
  source_log_id uuid unique,
  actor_type text not null default 'system',
  actor_id uuid,
  actor_email text,
  customer_id uuid references public.customers(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_history enable row level security;
drop policy if exists "admin history access" on public.admin_history;
create policy "admin history access" on public.admin_history
for all to authenticated
using(public.yt_is_admin()) with check(public.yt_is_admin());

create or replace function public.yt_copy_activity_to_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.admin_history(source_log_id,actor_type,actor_id,actor_email,customer_id,action,target_type,target_id,details,created_at)
  values(
    new.id,
    coalesce(new.actor_type,'system'),
    new.actor_id,
    (select au.email from public.admin_users au where au.id=new.actor_id limit 1),
    new.customer_id,
    new.action,
    new.target_type,
    new.target_id,
    coalesce(new.details,'{}'::jsonb),
    coalesce(new.created_at,now())
  )
  on conflict (source_log_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_yt_copy_activity_to_history on public.activity_logs;
create trigger trg_yt_copy_activity_to_history
after insert on public.activity_logs
for each row execute function public.yt_copy_activity_to_history();

-- Backfill existing audit/activity records into the separate History table.
insert into public.admin_history(source_log_id,actor_type,actor_id,actor_email,customer_id,action,target_type,target_id,details,created_at)
select a.id,a.actor_type,a.actor_id,
       (select au.email from public.admin_users au where au.id=a.actor_id limit 1),
       a.customer_id,a.action,a.target_type,a.target_id,coalesce(a.details,'{}'::jsonb),a.created_at
from public.activity_logs a
on conflict (source_log_id) do nothing;

create or replace function public.admin_list_history(p_limit integer default 500)
returns table(
  id uuid, source_log_id uuid, actor_type text, actor_id uuid, actor_email text,
  customer_id uuid, action text, target_type text, target_id uuid, details jsonb, created_at timestamptz,
  customer_name text
)
language sql security definer set search_path=public as $$
  select h.id,h.source_log_id,h.actor_type,h.actor_id,h.actor_email,h.customer_id,h.action,h.target_type,h.target_id,h.details,h.created_at,
         c.full_name as customer_name
  from public.admin_history h
  left join public.customers c on c.id=h.customer_id
  where public.yt_is_admin()
  order by h.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),1000));
$$;

create or replace function public.admin_delete_history(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete History'; end if;
  delete from public.admin_history where id=p_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_delete_all_history()
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint;
begin
  if not public.yt_is_super_admin() then raise exception 'Only Super Admin can delete History'; end if;
  delete from public.admin_history where id is not null;
  get diagnostics n=row_count;
  return n;
end $$;

grant execute on function public.admin_list_history(integer) to authenticated;
grant execute on function public.admin_delete_history(uuid) to authenticated;
grant execute on function public.admin_delete_all_history() to authenticated;

create index if not exists admin_history_created_idx on public.admin_history(created_at desc);
create index if not exists admin_history_action_idx on public.admin_history(action);
create index if not exists admin_history_customer_idx on public.admin_history(customer_id,created_at desc);
