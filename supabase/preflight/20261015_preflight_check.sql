-- =============================================================================
-- PRE-FLIGHT CHECK for the 20261015_* migrations  (READ-ONLY: changes nothing)
-- =============================================================================
-- Run in Supabase Dashboard -> SQL Editor, then "Download CSV" and share it.
--
-- The SQL editor only shows the result of the last statement, so everything is
-- returned as one table: (section, item, detail). Checks against tables or
-- columns that may not exist yet are run through query_to_xml() so a missing
-- object reports "n/a" instead of aborting the whole check.
-- =============================================================================

WITH
public_tables AS (
  SELECT c.relname AS name, c.relrowsecurity AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
has_col AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
checks AS (
  -- 1. Server version (security_invoker views etc. need 15+).
  SELECT 1 AS ord, 'postgres' AS section, 'version' AS item, version() AS detail

  -- 2. Every public table and whether row-level security is on.
  UNION ALL
  SELECT 2, 'table', name, 'rls=' || rls::text FROM public_tables

  -- 3. Columns of the tables the migrations touch or create.
  UNION ALL
  SELECT 3, 'columns:' || table_name, column_name,
         data_type
         || CASE WHEN is_nullable = 'NO' THEN ' not null' ELSE '' END
         || coalesce(' default ' || column_default, '')
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('orders', 'rfqs', 'quotes', 'product_variants', 'purchase_orders',
                       'coupons', 'document_counters')

  -- 4. Every RLS policy in public and storage.
  UNION ALL
  SELECT 4, 'policy:' || schemaname || '.' || tablename, policyname,
         cmd || ' to ' || array_to_string(roles, ',')
         || ' using(' || coalesce(qual, '') || ')'
         || ' check(' || coalesce(with_check, '') || ')'
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')

  -- 5. Triggers on public tables (anything that could fight the new functions).
  UNION ALL
  SELECT 5, 'trigger', event_object_table || '.' || trigger_name,
         action_timing || ' ' || event_manipulation
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'

  -- 6. Existing functions in public (to avoid name clashes).
  UNION ALL
  SELECT 6, 'function', p.proname, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'

  -- 7. Storage buckets.
  UNION ALL
  SELECT 7, 'bucket', id, 'public=' || public::text FROM storage.buckets

  -- 8. Constraints on orders and product_variants.
  UNION ALL
  SELECT 8, 'constraint:' || conrelid::regclass::text, conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid IN (to_regclass('public.orders'), to_regclass('public.product_variants'))

  -- 9. Data that would block a unique index or check constraint.
  UNION ALL
  SELECT 9, 'data', 'orders.total', (SELECT count(*)::text FROM public.orders)
  UNION ALL
  SELECT 9, 'data', 'orders.status=' || status, count(*)::text
  FROM public.orders GROUP BY status
  UNION ALL
  SELECT 9, 'data', 'orders.items_without_variant_id',
         (SELECT count(*)::text
          FROM public.orders o, jsonb_array_elements(o.items) e
          WHERE NOT coalesce(e ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  UNION ALL
  SELECT 9, 'data', 'orders.duplicate_invoice_numbers',
         CASE WHEN EXISTS (SELECT 1 FROM has_col WHERE table_name = 'orders' AND column_name = 'invoice_number')
           THEN (xpath('/row/n/text()', query_to_xml(
                  'SELECT count(*) AS n FROM (SELECT invoice_number FROM public.orders
                   WHERE invoice_number IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d',
                  false, true, '')))[1]::text
           ELSE 'n/a (column missing)' END
  UNION ALL
  SELECT 9, 'data', 'product_variants.negative_stock',
         (SELECT count(*)::text FROM public.product_variants WHERE stock_quantity < 0)
  UNION ALL
  SELECT 9, 'data', 'purchase_orders.variants_with_2+_active_POs',
         CASE WHEN to_regclass('public.purchase_orders') IS NOT NULL
           THEN (xpath('/row/n/text()', query_to_xml(
                  'SELECT count(*) AS n FROM (SELECT variant_id FROM public.purchase_orders
                   WHERE status IN (''Placed'', ''Dispatched / In Transit'')
                   GROUP BY 1 HAVING count(*) > 1) d',
                  false, true, '')))[1]::text
           ELSE 'n/a (table missing)' END
  UNION ALL
  SELECT 9, 'data', 'rfqs.rows',
         CASE WHEN to_regclass('public.rfqs') IS NOT NULL
           THEN (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM public.rfqs', false, true, '')))[1]::text
           ELSE 'n/a (table missing)' END
  UNION ALL
  SELECT 9, 'data', 'quotes.rows',
         CASE WHEN to_regclass('public.quotes') IS NOT NULL
           THEN (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM public.quotes', false, true, '')))[1]::text
           ELSE 'n/a (table missing)' END
  UNION ALL
  SELECT 9, 'data', 'profiles.by_role=' || role, count(*)::text
  FROM public.profiles GROUP BY role
)
SELECT section, item, detail
FROM checks
ORDER BY ord, section, item;
