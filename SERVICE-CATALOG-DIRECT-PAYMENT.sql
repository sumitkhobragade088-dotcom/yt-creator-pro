-- YT Creator Pro - Service Catalog + Direct Payment
-- Safe additive migration. Existing PayU websites are not touched.

create extension if not exists pgcrypto;

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_catalog enable row level security;

drop policy if exists "public can read active services" on public.service_catalog;
create policy "public can read active services"
on public.service_catalog for select
using (
  is_active = true
  or exists (select 1 from public.admin_users where id = auth.uid())
);

drop policy if exists "admin can insert services" on public.service_catalog;
create policy "admin can insert services"
on public.service_catalog for insert
with check (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "admin can update services" on public.service_catalog;
create policy "admin can update services"
on public.service_catalog for update
using (exists (select 1 from public.admin_users where id = auth.uid()))
with check (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "admin can delete services" on public.service_catalog;
create policy "admin can delete services"
on public.service_catalog for delete
using (exists (select 1 from public.admin_users where id = auth.uid()));

insert into public.service_catalog(name,description,price,is_active,sort_order)
values
 ('Channel Management','Channel setup and management support',0,true,10),
 ('Monetization Help','Eligibility and monetization assistance',0,true,20),
 ('AdSense Assistance','AdSense setup and support',0,true,30)
on conflict (name) do nothing;

create index if not exists service_catalog_active_idx on public.service_catalog(is_active,sort_order);
