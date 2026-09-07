-- YT Creator Pro - Free User Service grants
-- Additive only. Existing paid service/payment flow is preserved.

create extension if not exists pgcrypto;

create table if not exists public.free_service_grants (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel_access_id uuid not null references public.channel_access(id) on delete cascade,
  service_type text not null,
  status text not null default 'active',
  expires_at timestamptz null,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists free_service_grants_customer_idx on public.free_service_grants(customer_id);
create index if not exists free_service_grants_channel_idx on public.free_service_grants(channel_access_id);
create index if not exists free_service_grants_status_idx on public.free_service_grants(status,expires_at);

alter table public.free_service_grants enable row level security;

drop policy if exists "admin can view free service grants" on public.free_service_grants;
create policy "admin can view free service grants"
on public.free_service_grants for select
using (exists (select 1 from public.admin_users where id=auth.uid()));

drop policy if exists "admin can create free service grants" on public.free_service_grants;
create policy "admin can create free service grants"
on public.free_service_grants for insert
with check (exists (select 1 from public.admin_users where id=auth.uid()));

drop policy if exists "admin can update free service grants" on public.free_service_grants;
create policy "admin can update free service grants"
on public.free_service_grants for update
using (exists (select 1 from public.admin_users where id=auth.uid()))
with check (exists (select 1 from public.admin_users where id=auth.uid()));

-- Let the owner see only their own active grants.
drop policy if exists "customer can view own free service grants" on public.free_service_grants;
create policy "customer can view own free service grants"
on public.free_service_grants for select
using (customer_id in (select id from public.customers where user_id=auth.uid()));
