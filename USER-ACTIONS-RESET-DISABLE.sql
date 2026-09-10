-- USER ACTIONS: ADMIN USERS/CUSTOMERS
-- Run once in Supabase SQL Editor.
-- Adds account status and secure admin-only delete helper.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_account_status_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_account_status_check
  CHECK (account_status IN ('active','disabled'));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can read all customers" ON public.customers;
CREATE POLICY "admin can read all customers"
ON public.customers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id=auth.uid() AND COALESCE(a.status,'active')='active'));

DROP POLICY IF EXISTS "admin can update all customers" ON public.customers;
CREATE POLICY "admin can update all customers"
ON public.customers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id=auth.uid() AND COALESCE(a.status,'active')='active'))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id=auth.uid() AND COALESCE(a.status,'active')='active'));

DROP POLICY IF EXISTS "admin can delete customers" ON public.customers;
CREATE POLICY "admin can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id=auth.uid() AND COALESCE(a.status,'active')='active'));

-- Deletes the customer profile and its Auth account together.
-- Only an authenticated active admin can execute it.
CREATE OR REPLACE FUNCTION public.admin_delete_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND COALESCE(status,'active')='active') THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;
  SELECT user_id INTO v_user_id FROM public.customers WHERE id=p_customer_id;
  IF v_user_id IS NULL THEN RETURN false; END IF;
  DELETE FROM auth.users WHERE id=v_user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_customer(uuid) TO authenticated;
