-- ==============================================================================
-- Migration: 20261024_product_delete_safety
--
-- Deleting a product must never rewrite history. A product that was ever ordered,
-- quoted, invoiced, credited, debited, purchased or moved in the stock ledger is
-- ARCHIVED (hidden everywhere, SKU rows kept so returns / cancellations / credit
-- notes can still move stock and look up HSN). Only a product with no history is
-- really deleted.
-- ==============================================================================

-- 1. When the product was archived. Its SKUs get the same timestamp, so a restore
--    brings back exactly the SKUs this archive hid (not ones archived on their own).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. Purchase orders are history: a product delete may never wipe them (was CASCADE).
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_variant_id_fkey;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_product_id_fkey;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_variant_id_fkey FOREIGN KEY (variant_id)
    REFERENCES public.product_variants(id) ON DELETE RESTRICT;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE RESTRICT;

-- 3. Has this product ever been used? Opening-stock rows (INITIAL_IMPORT) and the
--    archive / restore markers do not count: every product has those.
CREATE OR REPLACE FUNCTION public.product_has_history(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_skus text[];
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_logs
             WHERE product_id = p_product_id
               AND movement_type NOT IN ('INITIAL_IMPORT', 'ARCHIVED', 'RESTORED')) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE product_id = p_product_id) THEN
    RETURN true;
  END IF;

  SELECT coalesce(array_agg(sku), '{}') INTO v_skus FROM product_variants WHERE product_id = p_product_id;

  -- Documents keep their lines as jsonb snapshots (no FK), so match on SKU / product id.
  RETURN
    EXISTS (SELECT 1 FROM orders d,
              jsonb_array_elements(CASE WHEN jsonb_typeof(d.items) = 'array' THEN d.items ELSE '[]'::jsonb END) i
            WHERE i->>'product_id' = p_product_id::text OR i->>'sku' = ANY (v_skus))
    OR EXISTS (SELECT 1 FROM invoices d,
              jsonb_array_elements(CASE WHEN jsonb_typeof(d.items) = 'array' THEN d.items ELSE '[]'::jsonb END) i
            WHERE i->>'sku' = ANY (v_skus))
    OR EXISTS (SELECT 1 FROM quotes d,
              jsonb_array_elements(CASE WHEN jsonb_typeof(d.items) = 'array' THEN d.items ELSE '[]'::jsonb END) i
            WHERE i->>'sku' = ANY (v_skus))
    OR EXISTS (SELECT 1 FROM credit_notes d,
              jsonb_array_elements(CASE WHEN jsonb_typeof(d.items) = 'array' THEN d.items ELSE '[]'::jsonb END) i
            WHERE i->>'sku' = ANY (v_skus))
    OR EXISTS (SELECT 1 FROM debit_notes d,
              jsonb_array_elements(CASE WHEN jsonb_typeof(d.items) = 'array' THEN d.items ELSE '[]'::jsonb END) i
            WHERE i->>'sku' = ANY (v_skus));
END $$;

-- 4. Archive: hide the product and every live SKU, one ARCHIVED ledger row per SKU.
CREATE OR REPLACE FUNCTION public.archive_product(p_product_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_now   timestamptz := now();
BEGIN
  SELECT title INTO v_title FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

  INSERT INTO inventory_logs (variant_id, product_id, sku_code, product_title, movement_type,
                              quantity_delta, balance_before, balance_after, notes, created_by)
  SELECT id, product_id, sku, v_title, 'ARCHIVED', 0, stock_quantity, stock_quantity,
         'Product archived by admin (history preserved)', p_actor
  FROM product_variants WHERE product_id = p_product_id AND NOT is_archived;

  UPDATE product_variants SET is_archived = true, archived_at = v_now
  WHERE product_id = p_product_id AND NOT is_archived;

  UPDATE products SET is_active = false, archived_at = v_now WHERE id = p_product_id;
END $$;

-- 5. Restore: bring back the product and the SKUs this archive hid.
CREATE OR REPLACE FUNCTION public.restore_product(p_product_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_at    timestamptz;
BEGIN
  SELECT title, archived_at INTO v_title, v_at FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

  IF v_at IS NOT NULL THEN
    INSERT INTO inventory_logs (variant_id, product_id, sku_code, product_title, movement_type,
                                quantity_delta, balance_before, balance_after, notes, created_by)
    SELECT id, product_id, sku, v_title, 'RESTORED', 0, stock_quantity, stock_quantity,
           'Product restored by admin', p_actor
    FROM product_variants WHERE product_id = p_product_id AND is_archived AND archived_at = v_at;

    UPDATE product_variants SET is_archived = false, archived_at = NULL
    WHERE product_id = p_product_id AND is_archived AND archived_at = v_at;
  END IF;

  UPDATE products SET is_active = true, archived_at = NULL WHERE id = p_product_id;
END $$;

-- 6. The one entry point: archive when there is history, delete when there is none.
--    Returns 'deleted' | 'archived'.
CREATE OR REPLACE FUNCTION public.remove_product(p_product_id uuid, p_actor uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

  IF product_has_history(p_product_id) THEN
    PERFORM archive_product(p_product_id, p_actor);
    RETURN 'archived';
  END IF;

  BEGIN
    -- product_categories has no FK to products; the other links cascade.
    DELETE FROM product_categories WHERE product_id = p_product_id;
    DELETE FROM products WHERE id = p_product_id;
    RETURN 'deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    -- Something we did not anticipate still points at it: keep it, hide it.
    PERFORM archive_product(p_product_id, p_actor);
    RETURN 'archived';
  END;
END $$;

REVOKE ALL ON FUNCTION public.product_has_history(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_product(uuid, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_product(uuid, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_product(uuid, uuid)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_has_history(uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_product(uuid, uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_product(uuid, uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_product(uuid, uuid)   TO service_role;

NOTIFY pgrst, 'reload schema';
