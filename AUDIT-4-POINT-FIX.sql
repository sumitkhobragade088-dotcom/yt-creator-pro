-- YT Creator Pro audit fix: allow a logged-in customer to update only their own customer row.
-- Safe/idempotent: existing Admin policies are not changed.

alter table public.customers enable row level security;

drop policy if exists "customer can update own profile" on public.customers;

create policy "customer can update own profile"
on public.customers
for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);
