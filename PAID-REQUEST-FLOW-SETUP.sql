-- YT Creator Pro - Paid Request Flow + Admin User Requests
-- Additive only. Does NOT change PayU keys/secrets or other websites.

-- Users must be able to create and read their own service requests.
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

-- Admin can read/update request processing status.
drop policy if exists "admin can view all service requests" on public.service_requests;
create policy "admin can view all service requests"
on public.service_requests for select
using (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "admin can update service requests" on public.service_requests;
create policy "admin can update service requests"
on public.service_requests for update
using (exists (select 1 from public.admin_users where id = auth.uid()))
with check (exists (select 1 from public.admin_users where id = auth.uid()));

-- Ensure payment invoice is created automatically from global Service Charge.
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
  where service_name = new.service_type and is_active = true
  limit 1;

  if v_charge is null or v_charge <= 0 then
    raise exception 'Service charge is not configured for %', new.service_type;
  end if;

  insert into public.payments(customer_id,request_id,service_name,amount,currency,status)
  values(new.customer_id,new.id,new.service_type,v_charge,'INR','pending')
  on conflict (request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_payment_for_service_request on public.service_requests;
create trigger trg_create_payment_for_service_request
after insert on public.service_requests
for each row execute function public.create_payment_for_service_request();
