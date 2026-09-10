-- User password reset + enable/disable support.
-- Run once in Supabase SQL Editor.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_account_status_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_account_status_check CHECK (account_status IN ('active','disabled'));
DROP FUNCTION IF EXISTS public.admin_list_normal_customers();
CREATE FUNCTION public.admin_list_normal_customers()
RETURNS TABLE (id uuid,user_id uuid,full_name text,email text,mobile text,channel_name text,channel_url text,created_at timestamptz,account_status text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.user_id,c.full_name,c.email,c.mobile,c.channel_name,c.channel_url,c.created_at,c.account_status
 FROM public.customers c
 WHERE COALESCE(c.is_deleted,false)=false
 AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id=c.user_id)
 AND NOT EXISTS (SELECT 1 FROM public.admin_staff_roles s WHERE s.admin_id=c.user_id)
 ORDER BY c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_list_normal_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_normal_customers() TO authenticated;
NOTIFY pgrst,'reload schema';
