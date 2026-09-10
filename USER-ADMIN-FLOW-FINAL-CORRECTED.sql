-- USER -> ADMIN DASHBOARD FINAL CORRECTION
-- Run this complete script once in Supabase SQL Editor.
-- Existing data is not deleted.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer can create own profile" ON public.customers;
CREATE POLICY "customer can create own profile"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "customer can read own profile" ON public.customers;
CREATE POLICY "customer can read own profile"
ON public.customers FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id = auth.uid()
      AND COALESCE(a.status,'active') = 'active'
  )
);

DROP POLICY IF EXISTS "customer can update own profile" ON public.customers;
CREATE POLICY "customer can update own profile"
ON public.customers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin Dashboard RPC: normal website customers only.
DROP FUNCTION IF EXISTS public.admin_list_normal_customers();

CREATE FUNCTION public.admin_list_normal_customers()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  mobile text,
  channel_name text,
  channel_url text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.user_id,
    c.full_name,
    c.email,
    c.mobile,
    c.channel_name,
    c.channel_url,
    c.created_at
  FROM public.customers c
  WHERE COALESCE(c.is_deleted,false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.id = c.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_staff_roles s
      WHERE s.admin_id = c.user_id
    )
  ORDER BY c.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_normal_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_normal_customers() TO authenticated;

-- Backfill Auth users that have no customer row.
-- Admin/staff accounts are excluded.
INSERT INTO public.customers (
  user_id, full_name, email, mobile, channel_name, channel_url, created_at, is_deleted
)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name',''),
  COALESCE(au.email,''),
  COALESCE(au.raw_user_meta_data->>'mobile',''),
  COALESCE(au.raw_user_meta_data->>'channel_name',''),
  COALESCE(au.raw_user_meta_data->>'channel_url',''),
  COALESCE(au.created_at,now()),
  false
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_users a WHERE a.id = au.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.admin_staff_roles s WHERE s.admin_id = au.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.customers c WHERE c.user_id = au.id
);

NOTIFY pgrst, 'reload schema';

-- Verification: this should return the normal website users.
SELECT * FROM public.admin_list_normal_customers();
