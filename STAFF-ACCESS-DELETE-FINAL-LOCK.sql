-- =========================================================
-- YT CREATOR PRO - STAFF ACCESS / DELETE FINAL LOCK
-- Uses admin_users.id (NOT user_id)
-- =========================================================

create or replace function public.admin_update_staff(
  p_admin_id uuid,
  p_role text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.yt_is_super_admin() then
    raise exception 'Only Super Admin can manage staff';
  end if;

  if p_admin_id = auth.uid() then
    raise exception 'Your Super Admin account is protected';
  end if;

  if p_role not in ('manager','operator','support') then
    raise exception 'Invalid staff role';
  end if;

  if p_status not in ('active','inactive','suspended') then
    raise exception 'Invalid staff status';
  end if;

  update public.admin_staff_roles
     set role=p_role,
         status=p_status,
         updated_at=now()
   where admin_id=p_admin_id;

  if not found then
    raise exception 'Staff role record not found';
  end if;

  return jsonb_build_object('ok',true);
end $$;


create or replace function public.admin_remove_staff(p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.yt_is_super_admin() then
    raise exception 'Only Super Admin can delete staff access';
  end if;

  if p_admin_id = auth.uid() then
    raise exception 'Your Super Admin account cannot be deleted';
  end if;

  -- Remove staff access first.
  delete from public.admin_staff_roles
   where admin_id=p_admin_id;

  -- Remove admin membership so Admin Login rejects this account.
  -- The Supabase Auth account itself is intentionally NOT deleted.
  delete from public.admin_users
   where id=p_admin_id;

  return jsonb_build_object(
    'ok',true,
    'admin_access_deleted',true,
    'auth_user_deleted',false
  );
end $$;

revoke all on function public.admin_update_staff(uuid,text,text) from public;
revoke all on function public.admin_remove_staff(uuid) from public;

grant execute on function public.admin_update_staff(uuid,text,text) to authenticated;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
