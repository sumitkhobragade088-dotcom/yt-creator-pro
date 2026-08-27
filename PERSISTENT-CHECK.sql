drop policy if exists "customer can view own access" on public.channel_access;

create policy "customer can view own access"
on public.channel_access
for select
using (
  customer_id in (
    select id from public.customers where user_id = auth.uid()
  )
);