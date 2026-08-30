-- YT Creator Pro - Combined Notifications + Pro Feature Suite
-- Run this ONE file in Supabase SQL Editor.

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


-- ===== PRO FEATURE SUITE =====
-- YT Creator Pro - Pro Feature Suite
-- Adds isolated feature tables, RLS, storage bucket, timeline/audit triggers.
-- Existing columns and existing policies are not altered.

create extension if not exists pgcrypto;

create table if not exists public.support_tickets(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_notes(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  note text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.request_documents(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.request_timeline(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  status text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.refund_requests(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete set null,
  request_type text not null default 'refund',
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id)
);

create table if not exists public.user_notification_preferences(
  customer_id uuid primary key references public.customers(id) on delete cascade,
  request_updates boolean not null default true,
  payment_updates boolean not null default true,
  support_updates boolean not null default true,
  announcements boolean not null default true,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs(
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  customer_id uuid references public.customers(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target text not null default 'all' check(target in ('all','public','user','admin')),
  is_maintenance boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_queue(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.user_blocks(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  is_blocked boolean not null default true,
  reason text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_settings(
  feature_key text primary key,
  is_enabled boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.feature_settings(feature_key,is_enabled) values
('support_tickets',true),('admin_notes',true),('documents',true),('timeline',true),('receipts',true),
('refunds',true),('notification_preferences',true),('activity_logs',true),
('user_blocking',true),('announcements',true),('public_announcements',true),
('analytics',true),('exports',true),('audit_log',true),('email_queue',true)
on conflict(feature_key) do nothing;

-- RLS
alter table public.support_tickets enable row level security;
alter table public.request_notes enable row level security;
alter table public.request_documents enable row level security;
alter table public.request_timeline enable row level security;
alter table public.refund_requests enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.activity_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.email_queue enable row level security;
alter table public.user_blocks enable row level security;
alter table public.feature_settings enable row level security;

-- helper expressions are repeated intentionally so no existing admin table dependency is required.
drop policy if exists "feature_admin_all_tickets" on public.support_tickets;
create policy "feature_admin_all_tickets" on public.support_tickets for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_tickets" on public.support_tickets;
create policy "feature_user_tickets" on public.support_tickets for all to authenticated
using(exists(select 1 from public.customers c where c.id=support_tickets.customer_id and c.user_id=auth.uid()))
with check(exists(select 1 from public.customers c where c.id=support_tickets.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_admin_notes" on public.request_notes;
create policy "feature_admin_notes" on public.request_notes for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "feature_admin_documents" on public.request_documents;
create policy "feature_admin_documents" on public.request_documents for select to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_admin_delete_documents" on public.request_documents;
create policy "feature_admin_delete_documents" on public.request_documents for delete to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_documents" on public.request_documents;
create policy "feature_user_documents" on public.request_documents for all to authenticated
using(exists(select 1 from public.customers c where c.id=request_documents.customer_id and c.user_id=auth.uid()))
with check(exists(select 1 from public.customers c where c.id=request_documents.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_admin_timeline" on public.request_timeline;
create policy "feature_admin_timeline" on public.request_timeline for select to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_timeline" on public.request_timeline;
create policy "feature_user_timeline" on public.request_timeline for select to authenticated
using(exists(select 1 from public.customers c where c.id=request_timeline.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_admin_refunds" on public.refund_requests;
create policy "feature_admin_refunds" on public.refund_requests for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_refunds" on public.refund_requests;
create policy "feature_user_refunds" on public.refund_requests for select to authenticated
using(exists(select 1 from public.customers c where c.id=refund_requests.customer_id and c.user_id=auth.uid()));
drop policy if exists "feature_user_refunds_insert" on public.refund_requests;
create policy "feature_user_refunds_insert" on public.refund_requests for insert to authenticated
with check(exists(select 1 from public.customers c where c.id=refund_requests.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_user_prefs" on public.user_notification_preferences;
create policy "feature_user_prefs" on public.user_notification_preferences for all to authenticated
using(exists(select 1 from public.customers c where c.id=user_notification_preferences.customer_id and c.user_id=auth.uid()))
with check(exists(select 1 from public.customers c where c.id=user_notification_preferences.customer_id and c.user_id=auth.uid()));
drop policy if exists "feature_admin_prefs" on public.user_notification_preferences;
create policy "feature_admin_prefs" on public.user_notification_preferences for select to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "feature_admin_activity" on public.activity_logs;
create policy "feature_admin_activity" on public.activity_logs for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_activity" on public.activity_logs;
create policy "feature_user_activity" on public.activity_logs for select to authenticated
using(exists(select 1 from public.customers c where c.id=activity_logs.customer_id and c.user_id=auth.uid()));
drop policy if exists "feature_user_activity_insert" on public.activity_logs;
create policy "feature_user_activity_insert" on public.activity_logs for insert to authenticated
with check(customer_id is null or exists(select 1 from public.customers c where c.id=activity_logs.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_public_announcements" on public.announcements;
create policy "feature_public_announcements" on public.announcements for select to anon,authenticated
using(is_active=true and target in ('public','all'));
drop policy if exists "feature_user_announcements" on public.announcements;
create policy "feature_user_announcements" on public.announcements for select to authenticated
using(is_active=true and target in ('user','all','public'));
drop policy if exists "feature_admin_announcements" on public.announcements;
create policy "feature_admin_announcements" on public.announcements for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "feature_admin_email_queue" on public.email_queue;
create policy "feature_admin_email_queue" on public.email_queue for select to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "feature_admin_user_blocks" on public.user_blocks;
create policy "feature_admin_user_blocks" on public.user_blocks for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_user_own_block" on public.user_blocks;
create policy "feature_user_own_block" on public.user_blocks for select to authenticated
using(exists(select 1 from public.customers c where c.id=user_blocks.customer_id and c.user_id=auth.uid()));

drop policy if exists "feature_settings_public_read" on public.feature_settings;
create policy "feature_settings_public_read" on public.feature_settings for select to anon,authenticated using(true);
drop policy if exists "feature_settings_admin_write" on public.feature_settings;
create policy "feature_settings_admin_write" on public.feature_settings for all to authenticated
using(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check(lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

-- storage bucket
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('user-documents','user-documents',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "feature_user_upload_documents" on storage.objects;
create policy "feature_user_upload_documents" on storage.objects for insert to authenticated
with check(bucket_id='user-documents' and exists(
  select 1 from public.customers c where c.user_id=auth.uid() and c.id::text=(storage.foldername(name))[1]
));
drop policy if exists "feature_user_read_documents" on storage.objects;
create policy "feature_user_read_documents" on storage.objects for select to authenticated
using(bucket_id='user-documents' and exists(
  select 1 from public.customers c where c.user_id=auth.uid() and c.id::text=(storage.foldername(name))[1]
));
drop policy if exists "feature_admin_read_documents" on storage.objects;
create policy "feature_admin_read_documents" on storage.objects for select to authenticated
using(bucket_id='user-documents' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
drop policy if exists "feature_admin_delete_storage_documents" on storage.objects;
create policy "feature_admin_delete_storage_documents" on storage.objects for delete to authenticated
using(bucket_id='user-documents' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

-- timeline + audit
create or replace function public.fc_request_timeline_audit() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.request_timeline(customer_id,request_id,status,message)
    values(new.customer_id,new.id,new.status,'Application created');
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('user',new.customer_id,'service_request_created','service_request',new.id,jsonb_build_object('service',new.service_type,'status',new.status));
  elsif old.status is distinct from new.status then
    insert into public.request_timeline(customer_id,request_id,status,message)
    values(new.customer_id,new.id,new.status,'Application status updated');
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('system',new.customer_id,'request_status_updated','service_request',new.id,jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end $$;
drop trigger if exists fc_request_timeline_audit on public.service_requests;
create trigger fc_request_timeline_audit after insert or update of status on public.service_requests
for each row execute function public.fc_request_timeline_audit();

create or replace function public.fc_payment_audit() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('system',new.customer_id,'payment_created','payment',new.id,jsonb_build_object('service',new.service_name,'amount',new.amount,'status',new.status));
  elsif old.status is distinct from new.status then
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('system',new.customer_id,'payment_status_updated','payment',new.id,jsonb_build_object('from',old.status,'to',new.status,'amount',new.amount));
    insert into public.request_timeline(customer_id,request_id,status,message)
    values(new.customer_id,new.request_id,'payment_'||new.status,'Payment status: '||new.status);
  end if;
  return new;
end $$;
drop trigger if exists fc_payment_audit on public.payments;
create trigger fc_payment_audit after insert or update of status on public.payments
for each row execute function public.fc_payment_audit();

create or replace function public.fc_customer_audit() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
  values('user',new.id,'user_registered','customer',new.id,jsonb_build_object('email',new.email));
  return new;
end $$;
drop trigger if exists fc_customer_audit on public.customers;
create trigger fc_customer_audit after insert on public.customers
for each row execute function public.fc_customer_audit();

-- helpful indexes
create index if not exists support_tickets_customer_idx on public.support_tickets(customer_id,created_at desc);
create index if not exists request_documents_customer_idx on public.request_documents(customer_id,created_at desc);
create index if not exists request_timeline_request_idx on public.request_timeline(request_id,created_at);
create index if not exists refund_requests_customer_idx on public.refund_requests(customer_id,created_at desc);
create index if not exists activity_logs_customer_idx on public.activity_logs(customer_id,created_at desc);
create index if not exists email_queue_created_idx on public.email_queue(created_at desc);


-- Support ticket notifications
create or replace function public.fc_support_ticket_notify() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(recipient_type,title,message,kind)
    values('admin','New Support Ticket',new.subject,'support');
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('user',new.customer_id,'support_ticket_created','support_ticket',new.id,jsonb_build_object('subject',new.subject));
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_type,customer_id,title,message,kind)
    values('user',new.customer_id,'Support Ticket Updated',new.subject||' is now '||new.status||'.','support');
    insert into public.activity_logs(actor_type,customer_id,action,target_type,target_id,details)
    values('system',new.customer_id,'support_ticket_status_updated','support_ticket',new.id,jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end $$;
drop trigger if exists fc_support_ticket_notify on public.support_tickets;
create trigger fc_support_ticket_notify after insert or update of status on public.support_tickets
for each row execute function public.fc_support_ticket_notify();

-- Refund notifications
create or replace function public.fc_refund_notify() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(recipient_type,title,message,kind)
    values('admin','New Refund Request','A refund/cancel request was submitted.','request');
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_type,customer_id,title,message,kind)
    values('user',new.customer_id,'Refund Request Updated','Refund request is now '||new.status||'.','request');
  end if;
  return new;
end $$;
drop trigger if exists fc_refund_notify on public.refund_requests;
create trigger fc_refund_notify after insert or update of status on public.refund_requests
for each row execute function public.fc_refund_notify();

-- Queue email events only when the user has explicitly enabled email notifications.
-- Delivery itself requires an external email provider/Edge Function later.
create or replace function public.fc_queue_request_email() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_email text; v_enabled boolean;
begin
  if tg_op='UPDATE' and old.status is distinct from new.status then
    select c.email,coalesce(p.email_enabled,false) into v_email,v_enabled
    from public.customers c left join public.user_notification_preferences p on p.customer_id=c.id
    where c.id=new.customer_id;
    if v_enabled and coalesce(v_email,'')<>'' then
      insert into public.email_queue(customer_id,to_email,subject,body)
      values(new.customer_id,v_email,'YT Creator Pro - Request Update',
             'Your '||coalesce(new.service_type,'service')||' request status is now '||coalesce(new.status,'updated')||'.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fc_queue_request_email on public.service_requests;
create trigger fc_queue_request_email after update of status on public.service_requests
for each row execute function public.fc_queue_request_email();

create or replace function public.fc_queue_payment_email() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_email text; v_enabled boolean;
begin
  if tg_op='UPDATE' and old.status is distinct from new.status then
    select c.email,coalesce(p.email_enabled,false) into v_email,v_enabled
    from public.customers c left join public.user_notification_preferences p on p.customer_id=c.id
    where c.id=new.customer_id;
    if v_enabled and coalesce(v_email,'')<>'' then
      insert into public.email_queue(customer_id,to_email,subject,body)
      values(new.customer_id,v_email,'YT Creator Pro - Payment Update',
             'Payment for '||coalesce(new.service_name,'service')||' is now '||coalesce(new.status,'updated')||'.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fc_queue_payment_email on public.payments;
create trigger fc_queue_payment_email after update of status on public.payments
for each row execute function public.fc_queue_payment_email();

-- Optional realtime for feature tables.
do $$
begin
  begin alter publication supabase_realtime add table public.support_tickets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.refund_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.activity_logs; exception when duplicate_object then null; end;
end $$;
