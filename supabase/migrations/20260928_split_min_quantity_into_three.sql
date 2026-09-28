-- Split the overloaded product_variants.min_quantity into three distinct columns.
--
-- min_quantity was serving two unrelated purposes at once:
--   1. the storefront's customer-facing minimum order quantity, and
--   2. the auto purchase-order reorder threshold.
-- As a result, any SKU with a customer MOQ silently generated a manufacturer
-- purchase order whenever stock dipped below it.
--
-- After this migration:
--   min_quantity        target stock level to restock up to (auto-PO only)
--   trigger_quantity    reorder threshold; auto-PO fires at or below it, 0 = off
--   min_order_quantity  customer-facing minimum order quantity (storefront)
--
-- Auto-PO quantity becomes: min_quantity - trigger_quantity

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS trigger_quantity   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_quantity integer NOT NULL DEFAULT 1;

-- Re-assert the default in case an earlier revision of this migration created
-- the column with DEFAULT 0.
ALTER TABLE public.product_variants
  ALTER COLUMN min_order_quantity SET DEFAULT 1;

-- Existing min_quantity values are in practice customer MOQs, so copy them
-- across to keep storefront behaviour identical. A customer cannot order zero
-- units, so the floor is 1. Idempotent on re-run.
UPDATE public.product_variants
SET min_order_quantity = GREATEST(min_quantity, 1)
WHERE min_order_quantity <= 1;

-- trigger_quantity deliberately stays 0 everywhere: auto-ordering is OFF until
-- an admin configures a threshold per SKU. Prevents a wave of surprise POs.
-- Unlike min_order_quantity, 0 is meaningful here -- it means "disabled".

COMMENT ON COLUMN public.product_variants.min_quantity       IS 'Minimum SKU Quantity: target stock level the auto purchase order restocks up to. Not customer-facing.';
COMMENT ON COLUMN public.product_variants.trigger_quantity   IS 'Reorder threshold: auto purchase order fires when stock_quantity <= this value. 0 disables auto-ordering.';
COMMENT ON COLUMN public.product_variants.min_order_quantity IS 'Customer-facing minimum order quantity shown and enforced on the storefront.';

-- Snapshot the trigger on the purchase order so historical rows stay
-- self-explanatory: order_quantity = min_quantity - trigger_quantity.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS trigger_quantity integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.purchase_orders.trigger_quantity IS 'Snapshot of the variant trigger_quantity at the moment this PO was generated.';
