-- YT Creator Pro - additive multi-service payment trigger update
-- Allows service_requests.service_type to contain multiple active service names separated by " | ".

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
    select charge into v_charge from public.service_charges
    where service_name=v_name and is_active=true limit 1;
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

-- Existing trigger name is retained; no other payment settings are changed.
