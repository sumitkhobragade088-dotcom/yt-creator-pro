create policy "customer can insert own channel access"
on public.channel_access
for insert
with check (
  customer_id in (
    select id from public.customers where user_id = auth.uid()
  )
);

create policy "customer can update own channel access"
on public.channel_access
for update
using (
  customer_id in (
    select id from public.customers where user_id = auth.uid()
  )
);