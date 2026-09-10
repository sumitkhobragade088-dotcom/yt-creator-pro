-- YT Creator Pro — Audit Log All Delete FIX
-- Minimum-change fix: only repairs the Audit Log "Delete All" RPC.
-- Reason: Supabase/PostgREST rejects DELETE statements without a WHERE clause.
-- This still permanently deletes ONLY activity_logs history, as intended.

create or replace function public.admin_delete_all_audit()
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  n bigint;
begin
  if not public.yt_is_super_admin() then
    raise exception 'Only Super Admin can delete audit logs';
  end if;

  -- Explicit WHERE keeps the DELETE safe for environments that require
  -- a WHERE clause while still matching every audit-log row.
  delete from public.activity_logs
  where id is not null;

  get diagnostics n = row_count;
  return n;
end
$$;

grant execute on function public.admin_delete_all_audit() to authenticated;
