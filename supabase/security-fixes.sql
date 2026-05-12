-- CSM Health App - Supabase Security Fixes
-- Run in: Supabase Dashboard > SQL Editor > New query > Run this query

-- FIX 1: Enable RLS on pending_users and add admin-only policies

ALTER TABLE public.pending_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_pending_users" ON public.pending_users;
DROP POLICY IF EXISTS "admins_insert_pending_users" ON public.pending_users;
DROP POLICY IF EXISTS "admins_update_pending_users" ON public.pending_users;
DROP POLICY IF EXISTS "admins_delete_pending_users" ON public.pending_users;

CREATE POLICY "admins_select_pending_users"
  ON public.pending_users FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admins_insert_pending_users"
  ON public.pending_users FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admins_update_pending_users"
  ON public.pending_users FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admins_delete_pending_users"
  ON public.pending_users FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- FIX 2: Restrict SECURITY DEFINER functions to authenticated users only

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_pending_user(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_user_from_pending() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.provision_pending_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- FIX 3: Pin search_path on SECURITY DEFINER functions

ALTER FUNCTION public.get_my_role() SET search_path = '';
ALTER FUNCTION public.provision_pending_user(uuid, text) SET search_path = '';
ALTER FUNCTION public.provision_user_from_pending() SET search_path = '';

-- VERIFY: run these separately to confirm each fix applied

-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_users';
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pending_users' ORDER BY policyname;
-- SELECT routine_name, grantee FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name IN ('get_my_role', 'provision_pending_user', 'provision_user_from_pending') AND grantee = 'PUBLIC';
-- SELECT proname, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('get_my_role', 'provision_pending_user', 'provision_user_from_pending');
