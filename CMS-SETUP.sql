-- YT Creator Pro CMS / Maintenance persistent settings
create table if not exists public.yt_cms_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.yt_cms_settings enable row level security;

drop policy if exists "cms public read" on public.yt_cms_settings;
create policy "cms public read" on public.yt_cms_settings for select using (true);

drop policy if exists "cms admin insert" on public.yt_cms_settings;
create policy "cms admin insert" on public.yt_cms_settings for insert to authenticated
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

drop policy if exists "cms admin update" on public.yt_cms_settings;
create policy "cms admin update" on public.yt_cms_settings for update to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');

drop policy if exists "cms admin delete" on public.yt_cms_settings;
create policy "cms admin delete" on public.yt_cms_settings for delete to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'sumitkhobragade088@gmail.com');
