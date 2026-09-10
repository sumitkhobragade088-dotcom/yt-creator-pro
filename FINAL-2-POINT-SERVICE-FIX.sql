-- YT Creator Pro — FINAL 2-POINT SERVICE + ADMIN ACCESS FIX
-- Run once in Supabase SQL Editor.
-- Scope: Admin Free User Service + User multi-service selection/payment.
-- Also removes the service_charges.amount mismatch and makes admin RLS
-- use the authenticated admin email, so the existing customer list is visible.

-- 1) Service charges: the project uses "charge", never "amount".
alter table public.service_charges enable row level security;

drop policy if exists "users can read active service charges" on public.service_charges;
create policy "users can read active service charges"
on public.service_charges for select
using (
  is_active = true
  or lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can read all service charges" on public.service_charges;
create policy "admin can read all service charges"
on public.service_charges for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

-- 2) Admin must be able to see the existing customer list.
alter table public.customers enable row level security;

drop policy if exists "admin can read all customers" on public.customers;
create policy "admin can read all customers"
on public.customers for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can update all customers" on public.customers;
create policy "admin can update all customers"
on public.customers for update
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

drop policy if exists "admin can delete customers" on public.customers;
create policy "admin can delete customers"
on public.customers for delete
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

-- 3) After choosing a customer, Admin must see that customer's channels.
alter table public.channel_access enable row level security;

drop policy if exists "admin can read all channel access" on public.channel_access;
create policy "admin can read all channel access"
on public.channel_access for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can update channel access" on public.channel_access;
create policy "admin can update channel access"
on public.channel_access for update
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

-- 4) Free User Service: Admin can grant any number of checked services.
alter table public.free_service_grants enable row level security;

drop policy if exists "admin can view free service grants" on public.free_service_grants;
create policy "admin can view free service grants"
on public.free_service_grants for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can create free service grants" on public.free_service_grants;
create policy "admin can create free service grants"
on public.free_service_grants for insert
with check (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can update free service grants" on public.free_service_grants;
create policy "admin can update free service grants"
on public.free_service_grants for update
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

-- 5) User service request: 1, 2, 3 ... any number of services.
alter table public.service_requests enable row level security;

drop policy if exists "customer can create own service requests" on public.service_requests;
create policy "customer can create own service requests"
on public.service_requests for insert
with check (
  customer_id in (select id from public.customers where user_id = auth.uid())
);

drop policy if exists "customer can view own service requests" on public.service_requests;
create policy "customer can view own service requests"
on public.service_requests for select
using (
  customer_id in (select id from public.customers where user_id = auth.uid())
);

-- Admin request visibility is kept working.
drop policy if exists "admin can view all service requests" on public.service_requests;
create policy "admin can view all service requests"
on public.service_requests for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can update service requests" on public.service_requests;
create policy "admin can update service requests"
on public.service_requests for update
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

-- 6) Create ONE payment record for the total of all selected services.
create or replace function public.create_payment_for_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_names text[];
  v_name text;
  v_charge numeric(12,2);
  v_total numeric(12,2) := 0;
begin
  v_names := regexp_split_to_array(new.service_type, '\s*\|\s*');

  foreach v_name in array v_names loop
    v_name := btrim(v_name);
    if v_name = '' then
      continue;
    end if;

    select charge into v_charge
      from public.service_charges
     where service_name = v_name
       and is_active = true
     limit 1;

    if v_charge is null or v_charge <= 0 then
      raise exception 'Service charge is not configured for %', v_name;
    end if;

    v_total := v_total + v_charge;
  end loop;

  if v_total <= 0 then
    raise exception 'No valid service selected';
  end if;

  insert into public.payments(
    customer_id, request_id, service_name, amount, currency, status
  )
  values(
    new.customer_id,
    new.id,
    array_to_string(v_names, ' | '),
    v_total,
    'INR',
    'pending'
  )
  on conflict (request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_payment_for_service_request on public.service_requests;
create trigger trg_create_payment_for_service_request
after insert on public.service_requests
for each row execute function public.create_payment_for_service_request();

-- 7) User can read their own generated payment.
alter table public.payments enable row level security;

drop policy if exists "customer can view own payments" on public.payments;
create policy "customer can view own payments"
on public.payments for select
using (
  customer_id in (select id from public.customers where user_id = auth.uid())
);

drop policy if exists "admin can view all payments" on public.payments;
create policy "admin can view all payments"
on public.payments for select
using (
  lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com'
);

drop policy if exists "admin can update payments" on public.payments;
create policy "admin can update payments"
on public.payments for update
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

-- IMPORTANT:
-- Do not create/use service_charges.amount.
-- The correct column is service_charges.charge.
