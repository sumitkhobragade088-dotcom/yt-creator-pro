-- Admin Settings global storage. Run once in Supabase SQL Editor.
create table if not exists public.admin_settings (
  admin_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
drop policy if exists "admin_settings_select_own" on public.admin_settings;
drop policy if exists "admin_settings_insert_own" on public.admin_settings;
drop policy if exists "admin_settings_update_own" on public.admin_settings;
create policy "admin_settings_select_own" on public.admin_settings for select to authenticated using (auth.uid() = admin_id);
create policy "admin_settings_insert_own" on public.admin_settings for insert to authenticated with check (auth.uid() = admin_id);
create policy "admin_settings_update_own" on public.admin_settings for update to authenticated using (auth.uid() = admin_id) with check (auth.uid() = admin_id);
grant select, insert, update on public.admin_settings to authenticated;
