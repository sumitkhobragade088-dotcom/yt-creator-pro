-- YT Creator Pro Dashboard Notifications
-- Adds a separate notification table + triggers. Existing table columns/policies are not changed.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('admin','user')),
  customer_id uuid null references public.customers(id) on delete cascade,
  title text not null,
  message text not null default '',
  kind text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_customer_created_idx on public.notifications(customer_id,created_at desc);
create index if not exists notifications_admin_created_idx on public.notifications(recipient_type,created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_admin_select" on public.notifications;
drop policy if exists "notifications_admin_update" on public.notifications;
drop policy if exists "notifications_user_select" on public.notifications;
drop policy if exists "notifications_user_update" on public.notifications;

create policy "notifications_admin_select" on public.notifications for select to authenticated
using (lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com' and recipient_type='admin');

create policy "notifications_admin_update" on public.notifications for update to authenticated
using (lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com' and recipient_type='admin')
with check (lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com' and recipient_type='admin');

create policy "notifications_user_select" on public.notifications for select to authenticated
using (recipient_type='user' and exists (
  select 1 from public.customers c where c.id=notifications.customer_id and c.user_id=auth.uid()
));

create policy "notifications_user_update" on public.notifications for update to authenticated
using (recipient_type='user' and exists (
  select 1 from public.customers c where c.id=notifications.customer_id and c.user_id=auth.uid()
))
with check (recipient_type='user' and exists (
  select 1 from public.customers c where c.id=notifications.customer_id and c.user_id=auth.uid()
));

create or replace function public.yt_notify_customer_created() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_type,title,message,kind)
  values('admin','New User',coalesce(new.full_name,new.email,'New customer')||' registered.','user');
  return new;
end $$;

create or replace function public.yt_notify_request_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(recipient_type,title,message,kind)
    values('admin','New Service Request',coalesce(new.service_type,'Service')||' request received.','request');
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_type,customer_id,title,message,kind)
    values('user',new.customer_id,'Request Status Updated',coalesce(new.service_type,'Service')||' is now '||coalesce(new.status,'updated')||'.','request');
  end if;
  return new;
end $$;

create or replace function public.yt_notify_payment_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(recipient_type,title,message,kind)
    values('admin','New Payment Record',coalesce(new.service_name,'Service')||' payment created.','payment');
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_type,title,message,kind)
    values('admin','Payment Updated',coalesce(new.service_name,'Service')||' payment is '||coalesce(new.status,'updated')||'.','payment');
    insert into public.notifications(recipient_type,customer_id,title,message,kind)
    values('user',new.customer_id,'Payment Updated',coalesce(new.service_name,'Service')||' payment is '||coalesce(new.status,'updated')||'.','payment');
  end if;
  return new;
end $$;

drop trigger if exists yt_notifications_customer_insert on public.customers;
create trigger yt_notifications_customer_insert after insert on public.customers
for each row execute function public.yt_notify_customer_created();

drop trigger if exists yt_notifications_request_change on public.service_requests;
create trigger yt_notifications_request_change after insert or update of status on public.service_requests
for each row execute function public.yt_notify_request_change();

drop trigger if exists yt_notifications_payment_change on public.payments;
create trigger yt_notifications_payment_change after insert or update of status on public.payments
for each row execute function public.yt_notify_payment_change();

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
