-- YT Creator Pro - Service Charge
-- Additive only. Existing PayU websites/integrations are NOT changed.

create extension if not exists pgcrypto;

create table if not exists public.service_charges (
  id uuid primary key default gen_random_uuid(),
  service_name text not null unique,
  description text not null default '',
  charge numeric(12,2) not null default 0 check (charge >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_charges enable row level security;

drop policy if exists "users can read active service charges" on public.service_charges;
create policy "users can read active service charges"
on public.service_charges for select
using (
  is_active = true
  or exists (select 1 from public.admin_users where id = auth.uid())
);

drop policy if exists "admin can insert service charges" on public.service_charges;
create policy "admin can insert service charges"
on public.service_charges for insert
with check (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "admin can update service charges" on public.service_charges;
create policy "admin can update service charges"
on public.service_charges for update
using (exists (select 1 from public.admin_users where id = auth.uid()))
with check (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "admin can delete service charges" on public.service_charges;
create policy "admin can delete service charges"
on public.service_charges for delete
using (exists (select 1 from public.admin_users where id = auth.uid()));

insert into public.service_charges(service_name,description,charge,is_active,sort_order)
values
 ('Channel Management','Channel setup and management support',0,true,10),
 ('Monetization Help','Eligibility and monetization assistance',0,true,20),
 ('AdSense Assistance','AdSense setup and support',0,true,30)
on conflict (service_name) do nothing;

create index if not exists service_charges_active_sort_idx
on public.service_charges(is_active,sort_order);

-- Automatically create a payment invoice from the service's current charge
-- whenever a customer submits a new service request.
create or replace function public.create_payment_for_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge numeric(12,2);
begin
  select charge into v_charge
  from public.service_charges
  where service_name = new.service_type
    and is_active = true
  limit 1;

  if v_charge is not null and v_charge > 0 then
    insert into public.payments(
      customer_id, request_id, service_name, amount, currency, status
    )
    values(
      new.customer_id, new.id, new.service_type, v_charge, 'INR', 'pending'
    )
    on conflict (request_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_payment_for_service_request on public.service_requests;
create trigger trg_create_payment_for_service_request
after insert on public.service_requests
for each row
execute function public.create_payment_for_service_request();
