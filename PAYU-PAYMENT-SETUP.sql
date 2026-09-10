-- YT Creator Pro - PayU Payment tables/policies
-- Existing 2 websites are NOT touched by this SQL.

create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  service_name text not null default 'Service',
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'pending',
  txnid text unique,
  mihpayid text,
  payment_mode text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id)
);

alter table public.payments enable row level security;

drop policy if exists "customer can view own payments" on public.payments;
create policy "customer can view own payments"
on public.payments for select
using (
  customer_id in (
    select id from public.customers where user_id = auth.uid()
  )
);

drop policy if exists "admin can view all payments" on public.payments;
create policy "admin can view all payments"
on public.payments for select
using (
  exists (select 1 from public.admin_users where id = auth.uid())
);

drop policy if exists "admin can create payments" on public.payments;
create policy "admin can create payments"
on public.payments for insert
with check (
  exists (select 1 from public.admin_users where id = auth.uid())
);

drop policy if exists "admin can update payments" on public.payments;
create policy "admin can update payments"
on public.payments for update
using (
  exists (select 1 from public.admin_users where id = auth.uid())
)
with check (
  exists (select 1 from public.admin_users where id = auth.uid())
);

create index if not exists payments_customer_id_idx on public.payments(customer_id);
create index if not exists payments_request_id_idx on public.payments(request_id);
create index if not exists payments_txnid_idx on public.payments(txnid);
