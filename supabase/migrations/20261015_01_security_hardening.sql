-- =============================================================================
-- 20261015_01_security_hardening.sql
-- Close database access that was open to anyone holding the public anon key.
-- =============================================================================
-- WHEN TO RUN: any time (before or after the app deploy).
--   Every application write to these tables already goes through the
--   service-role client inside a Server Action, and the service role bypasses
--   RLS. Only the storefront's public reads and admin reads depend on the
--   policies below, and both keep working.
--
-- FIXES
--   * products, product_variants, categories, product_categories, attributes and
--     product_attributes had `FOR ALL USING (true)` policies with no role, so
--     anyone could insert, update or delete catalogue rows and prices.
--   * product_variants (prices, stock, reorder levels) was publicly readable,
--     although prices are meant for approved customers only. The storefront
--     reads SKUs on the server and hides prices per viewer, so the table no
--     longer needs a public read policy.
--   * inventory_logs was readable by every signed-in customer, exposing other
--     customers' company names and order references.
--   * The category-images / product-documents buckets accepted anonymous
--     uploads, overwrites and deletes.
--   * profiles: any signed-in user could make themselves an approved admin.
--   * rfqs: anyone could read, change or delete every RFQ.
--
-- Idempotent: running it again leaves the same policies in place.
-- =============================================================================

BEGIN;

-- 1. Catalogue tables: public read (except SKUs), admin write ---------------------
-- Existing policies are dropped by lookup rather than by name: the live names
-- no longer match the repo after the tags -> attributes rename.
DO $$
DECLARE
  v_table  text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'products', 'product_variants', 'categories', 'product_categories',
    'attributes', 'product_attributes', 'tags', 'product_tags'
  ]
  LOOP
    CONTINUE WHEN to_regclass(format('public.%I', v_table)) IS NULL;

    FOR v_policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    -- SKUs carry prices and stock: no public read (see FIXES above).
    IF v_table <> 'product_variants' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        'Public can read ' || v_table, v_table
      );
    END IF;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (public.is_admin()) WITH CHECK (public.is_admin())',
      'Admins can manage ' || v_table, v_table
    );
  END LOOP;
END $$;

-- 2. Inventory logs: admins only --------------------------------------------------
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_logs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.inventory_logs', v_policy.policyname);
  END LOOP;
END $$;

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read inventory logs"
  ON public.inventory_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3. Storage: only admins may upload, replace or delete catalogue files -----------
-- Public read of these buckets is unchanged. Uploads from the app use the
-- service role, so these policies only stop direct calls with the anon key.
-- Every non-read policy on these two buckets is dropped by lookup: the live
-- project has hand-made ones ("product-documents admin upload", ...) open to
-- everyone. Wrapped so a project where the SQL editor cannot alter storage
-- policies still applies the other sections; the warning says what to do.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(category-images|product-documents)'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', v_policy.policyname);
  END LOOP;

  CREATE POLICY "Admins can upload catalogue files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('category-images', 'product-documents') AND public.is_admin());

  CREATE POLICY "Admins can update catalogue files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id IN ('category-images', 'product-documents') AND public.is_admin())
    WITH CHECK (bucket_id IN ('category-images', 'product-documents') AND public.is_admin());

  CREATE POLICY "Admins can delete catalogue files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id IN ('category-images', 'product-documents') AND public.is_admin());
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Storage policies NOT changed (insufficient privilege). In Dashboard -> '
                  'Storage -> Policies, delete every INSERT/UPDATE/DELETE policy on the '
                  'category-images and product-documents buckets.';
END $$;

-- 4. Profiles: no one may change their own role or approval -------------------------
-- Two hand-made policies in the live project undo the guarded "Users can update
-- own profile" policy (permissive policies are OR-ed together):
--   * "Users can update own profile or admin can update any": UPDATE with no
--     WITH CHECK, so any signed-in user can set their own role to 'admin' and
--     approval_status to 'approved' through the public API.
--   * "Users can insert their own profile": INSERT with no role check.
-- The app writes profiles only through the service role, so neither is needed.
DROP POLICY IF EXISTS "Users can update own profile or admin can update any" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 5. RFQs: customers read their own; everything else is server-only ------------------
-- The live "Service role full access on rfqs" policy is granted TO public, not
-- to service_role, so anyone (even signed out) can read, change or delete every
-- RFQ with its contact details. The customer insert/update policies would also
-- let a customer set their own status or quoted amount. The app writes RFQs
-- only through the service role.
DO $$
DECLARE
  v_policy record;
BEGIN
  IF to_regclass('public.rfqs') IS NULL THEN
    RETURN;
  END IF;
  FOR v_policy IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rfqs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.rfqs', v_policy.policyname);
  END LOOP;

  ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Customers can read own rfqs"
    ON public.rfqs FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  CREATE POLICY "Admins can read all rfqs"
    ON public.rfqs FOR SELECT TO authenticated
    USING (public.is_admin());
END $$;

COMMIT;
