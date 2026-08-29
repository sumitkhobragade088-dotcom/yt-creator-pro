create table if not exists public.yt_cms_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.yt_cms_settings enable row level security;
drop policy if exists "cms public read" on public.yt_cms_settings;
create policy "cms public read" on public.yt_cms_settings for select using (true);
drop policy if exists "cms admin write" on public.yt_cms_settings;
create policy "cms admin write" on public.yt_cms_settings for all to authenticated
using (lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
