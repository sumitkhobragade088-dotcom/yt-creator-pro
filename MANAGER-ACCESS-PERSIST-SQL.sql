-- Run once in Supabase SQL Editor.
-- Makes manager access permanently upsertable per customer.

alter table public.channel_access
add column if not exists manager_access boolean not null default false;

alter table public.channel_access
add column if not exists updated_at timestamptz default now();

create unique index if not exists channel_access_customer_id_unique
on public.channel_access(customer_id);
