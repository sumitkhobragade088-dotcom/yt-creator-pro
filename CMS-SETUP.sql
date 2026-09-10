-- YT Creator Pro CMS + Website CMS permanent storage setup
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

-- Public CMS image bucket (logo/banner/hero media)
insert into storage.buckets (id,name,public)
values ('yt-cms-media','yt-cms-media',true)
on conflict (id) do update set public=true;

drop policy if exists "yt cms media public read" on storage.objects;
create policy "yt cms media public read" on storage.objects for select
using (bucket_id='yt-cms-media');

drop policy if exists "yt cms media admin insert" on storage.objects;
create policy "yt cms media admin insert" on storage.objects for insert to authenticated
with check (bucket_id='yt-cms-media' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "yt cms media admin update" on storage.objects;
create policy "yt cms media admin update" on storage.objects for update to authenticated
using (bucket_id='yt-cms-media' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com')
with check (bucket_id='yt-cms-media' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');

drop policy if exists "yt cms media admin delete" on storage.objects;
create policy "yt cms media admin delete" on storage.objects for delete to authenticated
using (bucket_id='yt-cms-media' and lower(coalesce(auth.jwt()->>'email',''))='sumitkhobragade088@gmail.com');
