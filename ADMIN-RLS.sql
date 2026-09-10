-- Run this in Supabase SQL Editor.
-- It lets only the authorized admin read customer/request/access data.

create policy "admin can read all customers"
on public.customers
for select
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can update all customers"
on public.customers
for update
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can delete customers"
on public.customers
for delete
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can read all service requests"
on public.service_requests
for select
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can update service requests"
on public.service_requests
for update
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can read all channel access"
on public.channel_access
for select
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);

create policy "admin can update channel access"
on public.channel_access
for update
using (
  exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and a.email = 'sumitkhobragade088@gmail.com'
  )
);