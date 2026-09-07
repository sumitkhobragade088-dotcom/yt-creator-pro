-- YT Creator Pro — FINAL MULTI-SERVICE ERROR FIX
-- Run once in Supabase SQL Editor.
-- Fixes: service_charges.amount does not exist; admin cannot see existing customers.

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
  v_service_name text;
begin
  v_names := regexp_split_to_array(new.service_type, '\s*\|\s*');
  foreach v_name in array v_names loop
    v_name := btrim(v_name);
    if v_name = '' then continue; end if;
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
  if v_total <= 0 then raise exception 'No valid service selected'; end if;
  v_service_name := array_to_string(v_names, ' | ');
  insert into public.payments(customer_id,request_id,service_name,amount,currency,status)
  values(new.customer_id,new.id,v_service_name,v_total,'INR','pending')
  on conflict (request_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_payment_for_service_request on public.service_requests;
create trigger trg_create_payment_for_service_request
after insert on public.service_requests
for each row execute function public.create_payment_for_service_request();

alter table public.customers enable row level security;
drop policy if exists "admin can read all customers" on public.customers;
create policy "admin can read all customers"
on public.customers for select
using (exists (select 1 from public.admin_users a where a.id=auth.uid()));

alter table public.channel_access enable row level security;
drop policy if exists "admin can read all channel access" on public.channel_access;
create policy "admin can read all channel access"
on public.channel_access for select
using (exists (select 1 from public.admin_users a where a.id=auth.uid()));

alter table public.service_charges enable row level security;
drop policy if exists "admin can read all service charges" on public.service_charges;
create policy "admin can read all service charges"
on public.service_charges for select
using (exists (select 1 from public.admin_users a where a.id=auth.uid()));
