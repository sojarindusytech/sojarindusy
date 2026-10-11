-- =============================================================================
-- ROLLBACK for the 20261015_* migrations
-- =============================================================================
-- Use only when rolling the APP back to the version before the coupon release.
-- Run the sections you need, in order.
--
-- Deliberately NOT rolled back:
--   * 01_security_hardening: reverting it would re-open the catalogue and
--     storage to anonymous writes. The old app does not need the open policies.
--   * orders.discount_amount / coupon_code / coupon_snapshot / tax_snapshot /
--     idempotency_key: dropping them would erase the discount and GST history
--     of real orders. The old app ignores these columns.
--   * document_counters, rfqs, invoice_number, purchase_orders.is_auto:
--     harmless to the old app.
-- =============================================================================

-- A. Old checkout inserts orders with the customer session. Re-allow that ONLY
--    if the old app version is redeployed. This re-introduces the risk that a
--    customer can write an order directly, so remove it again on the next deploy.
BEGIN;
GRANT INSERT ON public.orders TO authenticated;
DROP POLICY IF EXISTS "Customers can insert own orders (rollback)" ON public.orders;
CREATE POLICY "Customers can insert own orders (rollback)"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
COMMIT;

-- B. Remove the functions added in 04.
BEGIN;
DROP FUNCTION IF EXISTS public.place_order(jsonb);
DROP FUNCTION IF EXISTS public.transition_order_status(uuid, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.adjust_variant_stock(uuid, text, integer, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.receive_purchase_order(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.coupon_checkout_context(text, uuid);
DROP FUNCTION IF EXISTS public.save_coupon(jsonb, uuid[], uuid[], uuid[], uuid);
DROP FUNCTION IF EXISTS public.remove_coupon(uuid);
DROP FUNCTION IF EXISTS public.coupon_usage_summary(uuid[]);
COMMIT;

-- C. Remove the coupon tables (03). Only if no real order has used a coupon:
--    redemptions are the audit trail for discounts already given.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.coupon_redemptions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.coupon_redemptions) THEN
    RAISE EXCEPTION 'Coupons have been used on real orders; keep the coupon tables.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.coupon_attempts;
DROP TABLE IF EXISTS public.coupon_redemptions;
DROP TABLE IF EXISTS public.coupon_customers;
DROP TABLE IF EXISTS public.coupon_categories;
DROP TABLE IF EXISTS public.coupon_products;
DROP TABLE IF EXISTS public.coupons;
DROP FUNCTION IF EXISTS public.tg_coupons_touch();
COMMIT;
