-- CMS A-Z Control Center
-- Run once in Supabase after the existing CMS/service setup scripts.
-- Adds no destructive changes. Existing tables/data are preserved.

create extension if not exists pgcrypto;

create table if not exists public.cms_form_definitions (
  id uuid primary key default gen_random_uuid(),
  service_name text not null unique,
  definition jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cms_form_definitions enable row level security;
drop policy if exists "cms forms public read active" on public.cms_form_definitions;
create policy "cms forms public read active" on public.cms_form_definitions for select using (is_active=true or exists(select 1 from public.admin_users where id=auth.uid()));
drop policy if exists "cms forms admin write" on public.cms_form_definitions;
create policy "cms forms admin write" on public.cms_form_definitions for all to authenticated using (exists(select 1 from public.admin_users where id=auth.uid())) with check (exists(select 1 from public.admin_users where id=auth.uid()));

create index if not exists cms_form_definitions_order_idx on public.cms_form_definitions(is_active,sort_order);

-- Keep the service catalog and service-charge catalog synchronized.
insert into public.service_catalog(name,description,price,is_active,sort_order)
select service_name,description,charge,is_active,sort_order from public.service_charges
on conflict(name) do update set description=excluded.description,price=excluded.price,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

-- Give existing CMS JSON a durable, documented namespace for A-Z controls.
insert into public.yt_cms_settings(key,value)
values
 ('cms_az_version','{"version":1,"features":["services","categories","forms","elements","media","global"]}'::jsonb),
 ('admin_cms','{"elementOverrides":[]}'::jsonb),
 ('website_cms','{"categories":[],"serviceForms":{},"elementOverrides":[]}'::jsonb)
on conflict(key) do update set value=public.yt_cms_settings.value || excluded.value,updated_at=now();

-- Runtime storage for CMS-configured service application fields.
create table if not exists public.request_form_data (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.request_form_data enable row level security;
drop policy if exists "request form user own" on public.request_form_data;
create policy "request form user own" on public.request_form_data for all to authenticated
using(exists(select 1 from public.customers c where c.id=request_form_data.customer_id and c.user_id=auth.uid()))
with check(exists(select 1 from public.customers c where c.id=request_form_data.customer_id and c.user_id=auth.uid()));
drop policy if exists "request form admin all" on public.request_form_data;
create policy "request form admin all" on public.request_form_data for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
create index if not exists request_form_data_request_idx on public.request_form_data(request_id);
