-- =============================================================================
-- ROLLBACK for 20261017_stock_ledger.sql
-- =============================================================================
-- Use only when rolling the APP back to the version before the stock ledger release.
-- AFTER this script, re-run supabase/migrations/20261015_04_order_and_coupon_functions.sql
-- (CREATE OR REPLACE) to restore the old place_order / transition_order_status /
-- adjust_variant_stock. Then redeploy the previous app version.
--
-- What this does:
--   * puts stock_quantity back to "available" (net of open-order reservations), which is what
--     the old app and the old functions expect;
--   * removes the invoice stock functions and the reservation column.
-- Deliberately kept: inventory_logs rows (including the new movement types), invoices and their
-- stock_* columns (harmless to the old app), orders.stock_fulfilled_at.
-- Stock already moved by hand-made invoices stays moved.
-- =============================================================================

BEGIN;

UPDATE public.product_variants
   SET stock_quantity = stock_quantity - reserved_quantity
 WHERE reserved_quantity > 0;

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_covers_reserved;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS reserved_quantity;

DROP FUNCTION IF EXISTS public.check_invoice_stock(jsonb);
DROP FUNCTION IF EXISTS public.post_invoice_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.reverse_invoice_stock(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.repost_invoice_stock(uuid, uuid, jsonb, jsonb);

-- Customers saw an order's invoice as soon as it existed before this release.
DROP POLICY IF EXISTS "Customers can read own invoices" ON public.invoices;
CREATE POLICY "Customers can read own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'issued');

COMMIT;
