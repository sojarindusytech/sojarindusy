-- =============================================================================
-- 20261015_05_lock_order_writes.sql
-- Orders can only be written by the server; customers read only their own.
-- =============================================================================
-- WHEN TO RUN: AFTER the new app version is deployed.
--   The currently deployed checkout inserts orders with the customer's own
--   session, so running this first would stop customers placing orders. The
--   new code places orders through public.place_order() as the service role,
--   which bypasses RLS and does not need an INSERT policy.
--
-- FIXES: the orders table was created by hand and its access rules are not in
-- the repo. If customers can insert or update orders directly with the anon
-- key, they can set any price, discount or status and skip every server check.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.orders', v_policy.policyname);
  END LOOP;
END $$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT / UPDATE / DELETE policy on purpose. Belt and braces:
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon;

COMMIT;
