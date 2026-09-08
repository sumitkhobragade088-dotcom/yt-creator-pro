-- YT Creator Pro CMS role-based authorization
-- Existing Super Admin remains full control. Manager can manage CMS only when granted website_cms.manage.

create or replace function public.yt_cms_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a
    where a.id = auth.uid()
      and (
        lower(coalesce(a.email,'')) = 'sumitkhobragade088@gmail.com'
        or exists (
          select 1
          from public.admin_staff_roles sr
          join public.admin_role_permissions rp on rp.role = sr.role
          where sr.admin_id = a.id
            and sr.status = 'active'
            and (sr.role = 'super_admin' or rp.permission_key = 'website_cms.manage')
        )
      )
  );
$$;

drop policy if exists "cms admin write" on public.yt_cms_settings;
create policy "cms admin write"
on public.yt_cms_settings
for all to authenticated
using (public.yt_cms_can_manage())
with check (public.yt_cms_can_manage());

-- CMS media writes use the same role permission.
drop policy if exists "yt cms media admin insert" on storage.objects;
create policy "yt cms media admin insert" on storage.objects
for insert to authenticated
with check (bucket_id='yt-cms-media' and public.yt_cms_can_manage());

drop policy if exists "yt cms media admin update" on storage.objects;
create policy "yt cms media admin update" on storage.objects
for update to authenticated
using (bucket_id='yt-cms-media' and public.yt_cms_can_manage())
with check (bucket_id='yt-cms-media' and public.yt_cms_can_manage());

drop policy if exists "yt cms media admin delete" on storage.objects;
create policy "yt cms media admin delete" on storage.objects
for delete to authenticated
using (bucket_id='yt-cms-media' and public.yt_cms_can_manage());
