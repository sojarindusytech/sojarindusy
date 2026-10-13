-- =============================================================================
-- 20261017_stock_ledger.sql
-- Reserve at order, deduct at invoice/shipment: one consistent stock ledger.
-- =============================================================================
-- Requires 20261015_01..05 and 20261010 (invoices). Safe to run once; the backfill
-- is guarded so a re-run does not double-count.
--
-- STOCK MODEL
--   product_variants.stock_quantity     physical units on hand (the warehouse count)
--   product_variants.reserved_quantity  units promised to open orders, not shipped yet
--   available = stock_quantity - reserved_quantity   (storefront, auto-PO trigger)
--
--   place_order              reserved += what is available (rest = backorder)
--   cancel (before ship)     reserved -= reservation
--   ship / deliver (1st)     on hand -= qty, reserved -= reservation   [needs on hand >= qty]
--   return                   on hand += qty
--   hand-made invoice        on hand -= qty  (refused if available < qty); edit = delta,
--                            cancel = give back
--   PO received / manual adjust   on hand +/-   (never below what is reserved)
--
-- Order-based invoices never touch stock themselves: the order owns it, so the invoice
-- raised when the order ships cannot double-count. Each invoice records who owns its
-- stock (invoices.stock_owner) and posts / reverses at most once.
-- =============================================================================

BEGIN;

-- 1. Columns ------------------------------------------------------------------
ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS reserved_delta integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.inventory_logs.reserved_delta IS
  'Change to reserved_quantity made by this movement (quantity_delta is the on-hand change).';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_fulfilled_at timestamptz;
COMMENT ON COLUMN public.orders.stock_fulfilled_at IS
  'When the goods left stock (first move to shipped/delivered). NULL = still only reserved.';

ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS invoice_reduces_stock boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.sales_settings.invoice_reduces_stock IS
  'Hand-made invoices reduce SKU stock when issued. Order invoices are unaffected (the order owns the stock).';

-- invoices: who owns the stock effect, and whether it is currently posted.
-- Existing invoices are legacy: their stock was handled by the old flow and must never be re-applied.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stock_owner text NOT NULL DEFAULT 'legacy'
    CHECK (stock_owner IN ('order', 'invoice', 'legacy', 'none')),
  ADD COLUMN IF NOT EXISTS stock_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_reversed_at timestamptz;
ALTER TABLE public.invoices ALTER COLUMN stock_owner SET DEFAULT 'none';
COMMENT ON COLUMN public.invoices.stock_owner IS
  'order = the linked order moved the stock; invoice = this invoice moved it; legacy/none = no stock effect.';

-- 2. reserved_quantity + one-time backfill ---------------------------------------
-- Until now an order deducted stock the moment it was placed, so stock_quantity was
-- really "available". Open (not yet shipped) orders hold that deduction as a
-- reservation: put it back on hand and record it as reserved. Shipped / delivered /
-- returned orders already left the warehouse, so they are only flagged as fulfilled.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'product_variants'
                    AND column_name = 'reserved_quantity') THEN

    ALTER TABLE public.product_variants
      ADD COLUMN reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);

    UPDATE public.orders
       SET stock_fulfilled_at = coalesce(dispatched_at, delivered_at, returned_at, updated_at, now())
     WHERE status IN ('shipped', 'delivered', 'returned') AND stock_fulfilled_at IS NULL;

    WITH open_lines AS (
      SELECT (i ->> 'id')::uuid AS variant_id,
             CASE WHEN i ->> 'reserved_quantity' ~ '^[0-9]+$' THEN (i ->> 'reserved_quantity')::integer
                  WHEN i ->> 'quantity' ~ '^[0-9]+(\.[0-9]+)?$' THEN round((i ->> 'quantity')::numeric)::integer
                  ELSE 0 END AS qty
        FROM public.orders o
        CROSS JOIN LATERAL jsonb_array_elements(
              CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) i
       WHERE o.status IN ('pending', 'confirmed', 'processing')
         AND coalesce(i ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ), per_variant AS (
      SELECT variant_id, sum(qty)::integer AS qty FROM open_lines GROUP BY variant_id HAVING sum(qty) > 0
    )
    UPDATE public.product_variants pv
       SET reserved_quantity = pv.reserved_quantity + p.qty,
           stock_quantity    = pv.stock_quantity + p.qty
      FROM per_variant p
     WHERE pv.id = p.variant_id;
  END IF;
END $$;

-- On hand always covers the reservations. (Bulk edits that would break this fail
-- with a clear constraint error instead of silently overselling.)
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_stock_covers_reserved;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_stock_covers_reserved
  CHECK (stock_quantity >= reserved_quantity);

-- 3. Customers see an order's invoice only once it is delivered ---------------------
-- Hand-made (order-less) invoices are visible as soon as they are issued.
DROP POLICY IF EXISTS "Customers can read own invoices" ON public.invoices;
CREATE POLICY "Customers can read own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'issued'
    AND (order_id IS NULL
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = invoices.order_id AND o.status = 'delivered'))
  );

-- 4. Order functions: reserve at order, deduct at shipment ----------------------------
-- (Copies of the 20261015_04 functions with the stock model above; everything else
-- in them is unchanged.)

CREATE OR REPLACE FUNCTION public.place_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_uuid_re CONSTANT text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  v_user_id      uuid;
  v_idem_key     uuid;
  v_tax_in       jsonb := p_order -> 'tax';
  v_gst_enabled  boolean;
  v_intra        boolean;
  v_discount     numeric(12, 2);
  v_coupon_in    jsonb := p_order -> 'coupon';
  v_coupon       public.coupons%ROWTYPE;
  v_used         integer;
  v_profile      record;
  v_existing     record;
  v_item         jsonb;
  v_qty          integer;
  v_reserved     integer;
  v_variant      record;
  v_line_total   numeric(12, 2);
  v_line_disc    numeric(12, 2);
  v_taxable      numeric(12, 2);
  v_rate         numeric;
  v_cgst         numeric(12, 2);
  v_sgst         numeric(12, 2);
  v_igst         numeric(12, 2);
  v_subtotal     numeric(12, 2) := 0;
  v_disc_sum     numeric(12, 2) := 0;
  v_cgst_sum     numeric(12, 2) := 0;
  v_sgst_sum     numeric(12, 2) := 0;
  v_igst_sum     numeric(12, 2) := 0;
  v_gst          numeric(12, 2);
  v_total        numeric(12, 2);
  v_items        jsonb := '[]'::jsonb;
  v_stock        jsonb := '[]'::jsonb;
  v_order_id     uuid;
  v_order_number text;
  v_company      text;
BEGIN
  -- 1. Validate input shape ------------------------------------------------------
  BEGIN
    v_user_id  := (p_order ->> 'user_id')::uuid;
    v_idem_key := (p_order ->> 'idempotency_key')::uuid;
    v_gst_enabled := (v_tax_in ->> 'gst_enabled')::boolean;
    v_intra       := (v_tax_in ->> 'intra_state')::boolean;
    v_discount := coalesce((p_order ->> 'discount_amount')::numeric, 0);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END;

  IF v_user_id IS NULL OR v_idem_key IS NULL OR v_gst_enabled IS NULL OR v_intra IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_order -> 'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_order -> 'items') = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount < 0 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(btrim(p_order ->> 'shipping_address'), '') = '' THEN
    RAISE EXCEPTION 'SHIPPING_ADDRESS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_order -> 'items') LOOP
    IF coalesce(v_item ->> 'variant_id', '') !~* c_uuid_re
       OR coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,9}$'
       OR (v_item ->> 'quantity')::integer <= 0
       OR coalesce(v_item ->> 'unit_price', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(v_item ->> 'discount_amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(v_item ->> 'gst_rate', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(v_item ->> 'cgst', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(v_item ->> 'sgst', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(v_item ->> 'igst', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF (v_item ->> 'gst_rate')::numeric > 100 THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 2. One checkout at a time per customer -------------------------------------------
  -- Serialises double-clicks, retries and parallel tabs, and makes the
  -- first-order check below race-free.
  PERFORM pg_advisory_xact_lock(hashtextextended('place_order:' || v_user_id::text, 0));

  -- 3. Idempotent replay: the same checkout attempt returns the same order ------------
  SELECT id, user_id, order_number, subtotal, discount_amount, gst_amount, total_amount
    INTO v_existing
    FROM public.orders
   WHERE idempotency_key = v_idem_key;

  IF FOUND THEN
    IF v_existing.user_id <> v_user_id THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'order_id',        v_existing.id,
      'order_number',    v_existing.order_number,
      'subtotal',        v_existing.subtotal,
      'discount_amount', v_existing.discount_amount,
      'gst_amount',      v_existing.gst_amount,
      'total_amount',    v_existing.total_amount,
      'replayed',        true,
      'stock',           '[]'::jsonb
    );
  END IF;

  -- 4. Only approved accounts may order ------------------------------------------------
  SELECT role, approval_status INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND
     OR (v_profile.approval_status <> 'approved' AND v_profile.role NOT IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  -- 5. Coupon: lock the row, then re-check everything that can change -------------------
  -- The server already evaluated eligibility and the discount. This re-checks,
  -- under the lock, the rules another request or an admin could have changed
  -- since: active/archived, version, dates, usage limits, first order.
  IF jsonb_typeof(v_coupon_in) = 'object' THEN
    IF coalesce(v_coupon_in ->> 'coupon_id', '') !~* c_uuid_re
       OR coalesce(v_coupon_in ->> 'version', '') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_coupon
      FROM public.coupons
     WHERE id = (v_coupon_in ->> 'coupon_id')::uuid
       FOR UPDATE;

    IF NOT FOUND OR v_coupon.deleted_at IS NOT NULL OR NOT v_coupon.is_active THEN
      RAISE EXCEPTION 'COUPON_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF v_coupon.version <> (v_coupon_in ->> 'version')::integer THEN
      RAISE EXCEPTION 'COUPON_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    IF now() < v_coupon.valid_from THEN
      RAISE EXCEPTION 'COUPON_NOT_STARTED' USING ERRCODE = 'P0001';
    END IF;
    IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
      RAISE EXCEPTION 'COUPON_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
    IF v_coupon.customer_scope = 'selected' AND NOT EXISTS (
         SELECT 1 FROM public.coupon_customers cc
          WHERE cc.coupon_id = v_coupon.id AND cc.user_id = v_user_id) THEN
      RAISE EXCEPTION 'COUPON_INVALID' USING ERRCODE = 'P0001';
    END IF;

    IF v_coupon.max_total_uses IS NOT NULL THEN
      SELECT count(*) INTO v_used
        FROM public.coupon_redemptions r
       WHERE r.coupon_id = v_coupon.id
         AND (r.status = 'applied' OR (r.status = 'reserved' AND r.expires_at > now()));
      IF v_used >= v_coupon.max_total_uses THEN
        RAISE EXCEPTION 'COUPON_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF v_coupon.max_uses_per_customer IS NOT NULL THEN
      SELECT count(*) INTO v_used
        FROM public.coupon_redemptions r
       WHERE r.coupon_id = v_coupon.id
         AND r.user_id = v_user_id
         AND (r.status = 'applied' OR (r.status = 'reserved' AND r.expires_at > now()));
      IF v_used >= v_coupon.max_uses_per_customer THEN
        RAISE EXCEPTION 'COUPON_CUSTOMER_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF v_coupon.first_order_only AND EXISTS (
         SELECT 1 FROM public.orders o
          WHERE o.user_id = v_user_id AND o.status <> 'cancelled') THEN
      RAISE EXCEPTION 'COUPON_FIRST_ORDER_ONLY' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_discount > 0 THEN
    -- A discount is only ever granted through a coupon.
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;

  -- 6. Order number (rolls back with the order if anything below fails) ------------------
  v_order_number := public.next_document_number('ORD');
  v_company := coalesce(nullif(p_order #>> '{customer_details,company_name}', ''), 'customer');

  -- 7. Lock every SKU in a fixed order so concurrent checkouts cannot deadlock --------------
  PERFORM 1
     FROM public.product_variants pv
    WHERE pv.id IN (SELECT (e ->> 'variant_id')::uuid FROM jsonb_array_elements(p_order -> 'items') e)
    ORDER BY pv.id
      FOR UPDATE;

  -- 8. Lines: availability, current price, minimum quantity; reserve what is on hand -------
  FOR v_item IN
    SELECT e.value FROM jsonb_array_elements(p_order -> 'items') WITH ORDINALITY AS e(value, pos)
    ORDER BY e.pos
  LOOP
    v_qty := (v_item ->> 'quantity')::integer;

    SELECT pv.id, pv.product_id, pv.sku, pv.list_price, pv.stock_quantity, pv.reserved_quantity,
           pv.min_order_quantity, pv.is_archived, p.title, p.is_active AS product_active
      INTO v_variant
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = (v_item ->> 'variant_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ITEM_UNAVAILABLE' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('variant_id', v_item ->> 'variant_id')::text;
    END IF;
    IF v_variant.is_archived OR NOT v_variant.product_active THEN
      RAISE EXCEPTION 'ITEM_UNAVAILABLE' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_variant.sku)::text;
    END IF;
    IF v_variant.list_price <> (v_item ->> 'unit_price')::numeric THEN
      RAISE EXCEPTION 'PRICE_CHANGED' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_variant.sku, 'price', v_variant.list_price)::text;
    END IF;
    IF v_qty < coalesce(v_variant.min_order_quantity, 1) THEN
      RAISE EXCEPTION 'BELOW_MIN_ORDER_QUANTITY' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_variant.sku, 'min', v_variant.min_order_quantity)::text;
    END IF;
    -- Available = on hand minus what open orders already reserved.
    v_reserved := least(greatest(v_variant.stock_quantity - v_variant.reserved_quantity, 0), v_qty);

    IF v_reserved > 0 THEN
      UPDATE public.product_variants
         SET reserved_quantity = reserved_quantity + v_reserved,
             updated_at        = now()
       WHERE id = v_variant.id;

      INSERT INTO public.inventory_logs (
        variant_id, product_id, sku_code, product_title, movement_type,
        quantity_delta, balance_before, balance_after, reference_id, notes, created_by, reserved_delta
      ) VALUES (
        v_variant.id, v_variant.product_id, v_variant.sku, v_variant.title, 'ORDER_RESERVATION',
        0, v_variant.stock_quantity, v_variant.stock_quantity, v_order_number,
        'Auto-reserved for ' || v_company
          || CASE WHEN v_qty > v_reserved
                  THEN format(' (%s more on backorder)', v_qty - v_reserved) ELSE '' END,
        v_user_id, v_reserved
      );
    END IF;

    v_line_total := round(v_variant.list_price * v_qty, 2);
    v_subtotal   := v_subtotal + v_line_total;

    -- Discount share and GST for this line, as computed by the app. The checks
    -- allow 1 paisa for rounding differences between the app and Postgres.
    v_line_disc := (v_item ->> 'discount_amount')::numeric;
    v_rate      := (v_item ->> 'gst_rate')::numeric;
    v_cgst      := (v_item ->> 'cgst')::numeric;
    v_sgst      := (v_item ->> 'sgst')::numeric;
    v_igst      := (v_item ->> 'igst')::numeric;
    IF v_line_disc > v_line_total THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE = 'P0001';
    END IF;
    v_taxable := v_line_total - v_line_disc;
    IF (NOT v_gst_enabled AND (v_rate <> 0 OR v_cgst + v_sgst + v_igst <> 0))
       OR (v_intra AND (v_igst <> 0
                        OR abs(v_cgst - round(v_taxable * v_rate / 200, 2)) > 0.01
                        OR abs(v_sgst - round(v_taxable * v_rate / 200, 2)) > 0.01))
       OR (NOT v_intra AND (v_cgst <> 0 OR v_sgst <> 0
                            OR abs(v_igst - round(v_taxable * v_rate / 100, 2)) > 0.01)) THEN
      RAISE EXCEPTION 'INVALID_TAX' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_variant.sku)::text;
    END IF;
    v_disc_sum := v_disc_sum + v_line_disc;
    v_cgst_sum := v_cgst_sum + v_cgst;
    v_sgst_sum := v_sgst_sum + v_sgst;
    v_igst_sum := v_igst_sum + v_igst;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',                   v_variant.id,
      'product_id',           v_variant.product_id,
      'name',                 coalesce(nullif(v_item ->> 'name', ''), v_variant.title),
      'sku',                  v_variant.sku,
      'quantity',             v_qty,
      'reserved_quantity',    v_reserved,
      'backordered_quantity', v_qty - v_reserved,
      'unit_price',           v_variant.list_price,
      'total_price',          v_line_total,
      'discount_amount',      v_line_disc,
      'taxable_amount',       v_taxable,
      'gst_rate',             v_rate,
      'gst_amount',           v_cgst + v_sgst + v_igst,
      'specifications',       coalesce(v_item -> 'specifications', '{}'::jsonb)
    ));
    v_stock := v_stock || jsonb_build_array(jsonb_build_object(
      'variant_id',  v_variant.id,
      'stock_after', v_variant.stock_quantity - v_variant.reserved_quantity - v_reserved,
      'backordered', v_qty - v_reserved
    ));
  END LOOP;

  -- 9. Totals: discount comes off before GST; GST is the sum of the checked lines ----------
  IF v_coupon.id IS NOT NULL THEN
    -- Upper bounds that hold for any correct evaluation; a breach means a bug,
    -- so refuse rather than give away more than the coupon allows.
    IF v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'COUPON_MIN_ORDER_NOT_MET' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('min_order_value', v_coupon.min_order_value)::text;
    END IF;
    IF v_discount <= 0
       OR (v_coupon.discount_type = 'fixed'   AND v_discount > v_coupon.discount_value)
       OR (v_coupon.discount_type = 'percent' AND v_discount > round(v_subtotal * v_coupon.discount_value / 100, 2))
       OR (v_coupon.max_discount IS NOT NULL  AND v_discount > v_coupon.max_discount) THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_discount > v_subtotal OR v_disc_sum <> v_discount THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE = 'P0001';
  END IF;

  v_gst   := v_cgst_sum + v_sgst_sum + v_igst_sum;
  v_total := v_subtotal - v_discount + v_gst;

  -- 10. Save the order and its redemption ----------------------------------------------------
  INSERT INTO public.orders (
    user_id, order_number, status, subtotal, discount_amount, gst_amount, total_amount,
    items, shipping_address, customer_details, notes,
    coupon_code, coupon_snapshot, tax_snapshot, idempotency_key
  ) VALUES (
    v_user_id, v_order_number, 'pending', v_subtotal, v_discount, v_gst, v_total,
    v_items, btrim(p_order ->> 'shipping_address'),
    coalesce(p_order -> 'customer_details', '{}'::jsonb),
    nullif(btrim(coalesce(p_order ->> 'notes', '')), ''),
    v_coupon.code,
    CASE WHEN v_coupon.id IS NULL THEN NULL ELSE jsonb_build_object(
      'coupon_id',             v_coupon.id,
      'code',                  v_coupon.code,
      'description',           v_coupon.description,
      'discount_type',         v_coupon.discount_type,
      'discount_value',        v_coupon.discount_value,
      'max_discount',          v_coupon.max_discount,
      'min_order_value',       v_coupon.min_order_value,
      'applies_to',            v_coupon.applies_to,
      'first_order_only',      v_coupon.first_order_only,
      'version',               v_coupon.version,
      'eligible_subtotal',     v_coupon_in -> 'eligible_subtotal'
    ) END,
    jsonb_build_object(
      'gst_enabled',       v_gst_enabled,
      'seller_state_code', nullif(v_tax_in ->> 'seller_state_code', ''),
      'place_of_supply',   nullif(v_tax_in ->> 'place_of_supply', ''),
      'intra_state',       v_intra,
      'cgst',              v_cgst_sum,
      'sgst',              v_sgst_sum,
      'igst',              v_igst_sum
    ),
    v_idem_key
  )
  RETURNING id INTO v_order_id;

  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, order_id, user_id, coupon_code, discount_amount, status)
    VALUES (v_coupon.id, v_order_id, v_user_id, v_coupon.code, v_discount, 'applied');
  END IF;

  RETURN jsonb_build_object(
    'order_id',        v_order_id,
    'order_number',    v_order_number,
    'subtotal',        v_subtotal,
    'discount_amount', v_discount,
    'gst_amount',      v_gst,
    'total_amount',    v_total,
    'replayed',        false,
    'stock',           v_stock
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_changes    jsonb DEFAULT '{}'::jsonb,
  p_actor      uuid  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_uuid_re CONSTANT text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_order    public.orders%ROWTYPE;
  v_old      text;
  v_changes  jsonb := coalesce(p_changes, '{}'::jsonb);
  v_item     jsonb;
  v_qty      integer;
  v_after    integer;
  v_variant  record;
  v_res      integer;
  v_released integer := 0;
BEGIN
  IF p_new_status NOT IN ('pending', 'confirmed', 'processing', 'shipped',
                          'delivered', 'returned', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  v_old := v_order.status;

  IF v_old <> p_new_status THEN
    IF v_old IN ('cancelled', 'returned') THEN
      RAISE EXCEPTION 'ORDER_CLOSED' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('status', v_old)::text;
    END IF;
    IF v_old = 'delivered' AND p_new_status <> 'returned' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('from', v_old, 'to', p_new_status)::text;
    END IF;
    IF p_new_status = 'returned' AND v_old NOT IN ('shipped', 'delivered') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('from', v_old, 'to', p_new_status)::text;
    END IF;
    -- Once goods have shipped, stock is out and the invoice is raised: the order can only
    -- go forward (delivered) or come back as a return, never back to a pre-ship status.
    IF v_order.stock_fulfilled_at IS NOT NULL
       AND p_new_status IN ('pending', 'confirmed', 'processing', 'cancelled') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('from', v_old, 'to', p_new_status)::text;
    END IF;
  END IF;

  UPDATE public.orders o SET
    status          = p_new_status,
    courier_partner = CASE WHEN v_changes ? 'courier_partner'
                           THEN nullif(btrim(v_changes ->> 'courier_partner'), '') ELSE o.courier_partner END,
    awb_number      = CASE WHEN v_changes ? 'awb_number'
                           THEN nullif(btrim(v_changes ->> 'awb_number'), '') ELSE o.awb_number END,
    tracking_url    = CASE WHEN v_changes ? 'tracking_url'
                           THEN nullif(btrim(v_changes ->> 'tracking_url'), '') ELSE o.tracking_url END,
    notes           = CASE WHEN v_changes ? 'notes'
                           THEN nullif(btrim(v_changes ->> 'notes'), '') ELSE o.notes END,
    return_reason   = CASE
                        WHEN v_changes ? 'return_reason'
                          THEN nullif(btrim(v_changes ->> 'return_reason'), '')
                        WHEN p_new_status = 'returned' AND o.return_reason IS NULL
                          THEN nullif(btrim(v_changes ->> 'notes'), '')
                        ELSE o.return_reason
                      END,
    dispatched_at   = CASE WHEN p_new_status = 'shipped' AND o.dispatched_at IS NULL
                           THEN now() ELSE o.dispatched_at END,
    delivered_at    = CASE WHEN p_new_status = 'delivered' AND o.delivered_at IS NULL
                           THEN now() ELSE o.delivered_at END,
    returned_at     = CASE WHEN p_new_status = 'returned' AND v_old <> 'returned'
                           THEN now() ELSE o.returned_at END,
    updated_at      = now()
  WHERE o.id = p_order_id
  RETURNING * INTO v_order;

  -- Stock moves exactly once, because the order row is locked:
  --   shipped / delivered (first time)  goods leave: on hand -qty, reservation released.
  --                                     Refused with INSUFFICIENT_STOCK if on hand is short.
  --   cancelled (never fulfilled)       the reservation is released; on hand never changed.
  --   returned                          every unit goes back on hand.
  IF p_new_status IN ('shipped', 'delivered') AND v_order.stock_fulfilled_at IS NULL THEN
    FOR v_item IN
      SELECT value FROM jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb))
       ORDER BY value ->> 'id'
    LOOP
      -- Legacy lines without a real SKU id ("item-1") have no stock to move.
      CONTINUE WHEN coalesce(v_item ->> 'id', '') !~* c_uuid_re;
      CONTINUE WHEN coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]+)?$';
      v_qty := round((v_item ->> 'quantity')::numeric)::integer;
      CONTINUE WHEN v_qty <= 0;

      SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, pv.reserved_quantity
        INTO v_variant
        FROM public.product_variants pv
       WHERE pv.id = (v_item ->> 'id')::uuid
         FOR UPDATE;
      CONTINUE WHEN NOT FOUND;

      -- What this line reserved. Orders placed before reserved_quantity existed
      -- reserved everything (they are backfilled that way too).
      v_res := least(
        CASE WHEN coalesce(v_item ->> 'reserved_quantity', '') ~ '^[0-9]+$'
             THEN (v_item ->> 'reserved_quantity')::integer ELSE v_qty END,
        v_variant.reserved_quantity);

      -- Goods promised to OTHER open orders cannot be shipped here: this order may use
      -- what is on hand minus everyone else's reservations (its own reservation included).
      IF v_variant.stock_quantity - (v_variant.reserved_quantity - v_res) < v_qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001',
          DETAIL = jsonb_build_object('sku', v_variant.sku, 'required', v_qty,
                     'available', greatest(v_variant.stock_quantity - (v_variant.reserved_quantity - v_res), 0),
                     'short', v_qty - greatest(v_variant.stock_quantity - (v_variant.reserved_quantity - v_res), 0))::text;
      END IF;

      UPDATE public.product_variants pv
         SET stock_quantity    = pv.stock_quantity - v_qty,
             reserved_quantity = pv.reserved_quantity - v_res,
             updated_at        = now()
       WHERE pv.id = v_variant.id;

      INSERT INTO public.inventory_logs (
        variant_id, product_id, sku_code, product_title, movement_type,
        quantity_delta, balance_before, balance_after, reference_id, notes, created_by, reserved_delta
      ) VALUES (
        v_variant.id, v_variant.product_id, v_variant.sku,
        coalesce(nullif(v_item ->> 'name', ''), 'Tooling Item'), 'ORDER_FULFILLED',
        -v_qty, v_variant.stock_quantity, v_variant.stock_quantity - v_qty, v_order.order_number,
        'Shipped on order ' || v_order.order_number, p_actor, -v_res
      );
    END LOOP;

    UPDATE public.orders SET stock_fulfilled_at = now() WHERE id = p_order_id
    RETURNING * INTO v_order;
  END IF;

  IF v_old <> p_new_status AND p_new_status IN ('cancelled', 'returned') THEN
    FOR v_item IN
      SELECT value FROM jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb))
       ORDER BY value ->> 'id'
    LOOP
      CONTINUE WHEN coalesce(v_item ->> 'id', '') !~* c_uuid_re;
      CONTINUE WHEN coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]+)?$';
      v_qty := round((v_item ->> 'quantity')::numeric)::integer;

      IF p_new_status = 'cancelled' THEN
        -- Never shipped: release only what it reserved (backordered units were never taken).
        IF coalesce(v_item ->> 'reserved_quantity', '') ~ '^[0-9]+$' THEN
          v_qty := (v_item ->> 'reserved_quantity')::integer;
        END IF;
        CONTINUE WHEN v_qty <= 0;

        UPDATE public.product_variants pv
           SET reserved_quantity = greatest(0, pv.reserved_quantity - v_qty),
               updated_at        = now()
         WHERE pv.id = (v_item ->> 'id')::uuid
        RETURNING pv.id, pv.product_id, pv.sku, pv.stock_quantity INTO v_variant;
        CONTINUE WHEN NOT FOUND;

        INSERT INTO public.inventory_logs (
          variant_id, product_id, sku_code, product_title, movement_type,
          quantity_delta, balance_before, balance_after, reference_id, notes, created_by, reserved_delta
        ) VALUES (
          v_variant.id, v_variant.product_id, v_variant.sku,
          coalesce(nullif(v_item ->> 'name', ''), 'Tooling Item'), 'ORDER_CANCELLED',
          0, v_variant.stock_quantity, v_variant.stock_quantity, v_order.order_number,
          'Reservation released after order cancellation', p_actor, -v_qty
        );
      ELSE
        CONTINUE WHEN v_qty <= 0;

        UPDATE public.product_variants pv
           SET stock_quantity = pv.stock_quantity + v_qty,
               updated_at     = now()
         WHERE pv.id = (v_item ->> 'id')::uuid
        RETURNING pv.id, pv.product_id, pv.sku, pv.stock_quantity INTO v_variant;
        CONTINUE WHEN NOT FOUND;

        INSERT INTO public.inventory_logs (
          variant_id, product_id, sku_code, product_title, movement_type,
          quantity_delta, balance_before, balance_after, reference_id, notes, created_by
        ) VALUES (
          v_variant.id, v_variant.product_id, v_variant.sku,
          coalesce(nullif(v_item ->> 'name', ''), 'Tooling Item'), 'RETURN_RESTOCK',
          v_qty, v_variant.stock_quantity - v_qty, v_variant.stock_quantity, v_order.order_number,
          'Customer return restocked: ' || coalesce(v_order.return_reason, 'Goods returned to warehouse'),
          p_actor
        );
      END IF;
    END LOOP;
  END IF;

  -- A cancelled order gives its coupon use back; a returned one does not.
  IF v_old <> 'cancelled' AND p_new_status = 'cancelled' THEN
    UPDATE public.coupon_redemptions
       SET status = 'released', released_at = now(), release_reason = 'order_cancelled', updated_at = now()
     WHERE order_id = p_order_id AND status IN ('applied', 'reserved');
    GET DIAGNOSTICS v_released = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'order_id',          v_order.id,
    'order_number',      v_order.order_number,
    'user_id',           v_order.user_id,
    'previous_status',   v_old,
    'status',            v_order.status,
    'invoice_number',    v_order.invoice_number,
    'courier_partner',   v_order.courier_partner,
    'coupons_released',  v_released
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_variant_stock(
  p_variant_id    uuid,
  p_mode          text,
  p_quantity      integer,
  p_movement_type text DEFAULT 'MANUAL_ADJUSTMENT',
  p_reference     text DEFAULT NULL,
  p_notes         text DEFAULT NULL,
  p_actor         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_variant record;
  v_target  integer;
BEGIN
  IF p_mode NOT IN ('ADD', 'SUBTRACT', 'SET') OR p_quantity IS NULL OR p_quantity < 0 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;

  SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, pv.reserved_quantity, p.title
    INTO v_variant
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
   WHERE pv.id = p_variant_id
     FOR UPDATE OF pv;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_target := CASE p_mode
                WHEN 'ADD'      THEN v_variant.stock_quantity + p_quantity
                WHEN 'SUBTRACT' THEN greatest(0, v_variant.stock_quantity - p_quantity)
                ELSE p_quantity
              END;

  -- On-hand cannot drop below what open orders have reserved.
  IF v_target < v_variant.reserved_quantity THEN
    RAISE EXCEPTION 'BELOW_RESERVED' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('sku', v_variant.sku, 'reserved', v_variant.reserved_quantity,
                                  'requested', v_target)::text;
  END IF;

  IF v_target <> v_variant.stock_quantity THEN
    UPDATE public.product_variants
       SET stock_quantity = v_target, updated_at = now()
     WHERE id = v_variant.id;

    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      v_variant.id, v_variant.product_id, v_variant.sku, v_variant.title,
      coalesce(p_movement_type, 'MANUAL_ADJUSTMENT'),
      v_target - v_variant.stock_quantity, v_variant.stock_quantity, v_target,
      nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), p_actor
    );
  END IF;

  RETURN jsonb_build_object(
    'variant_id',     v_variant.id,
    'sku',            v_variant.sku,
    'balance_before', v_variant.stock_quantity,
    'balance_after',  v_target
  );
END;
$$;

-- 5. Invoice stock: hand-made invoices -------------------------------------------------
-- check_invoice_stock: read-only. Returns [{sku, required, available}] for every line
-- that cannot be covered, so the app can refuse BEFORE it uses up an invoice number.
CREATE OR REPLACE FUNCTION public.check_invoice_stock(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'sku', g.sku, 'required', g.qty,
           'available', greatest(pv.stock_quantity - pv.reserved_quantity, 0))), '[]'::jsonb)
    FROM (
      SELECT l ->> 'sku' AS sku, sum(round((l ->> 'quantity')::numeric))::integer AS qty
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) l
       WHERE coalesce(l ->> 'sku', '') <> '' AND coalesce(l ->> 'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
       GROUP BY 1
    ) g
    JOIN public.product_variants pv ON pv.sku = g.sku
   WHERE pv.stock_quantity - pv.reserved_quantity < g.qty
$$;

-- post_invoice_stock: take the invoice's SKU units off the shelf, exactly once.
-- Lines without a catalogue SKU (custom lines) are ignored.
CREATE OR REPLACE FUNCTION public.post_invoice_stock(p_invoice_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_row record;
  v_moved integer := 0;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.stock_owner <> 'invoice'
     OR (v_inv.stock_posted_at IS NOT NULL AND v_inv.stock_reversed_at IS NULL) THEN
    RETURN jsonb_build_object('posted', false, 'invoice_number', v_inv.invoice_number);
  END IF;

  -- Variants are locked in id order, like the order functions, so they cannot deadlock.
  FOR v_row IN
    SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, pv.reserved_quantity, p.title, g.qty
      FROM (
        SELECT l ->> 'sku' AS sku, sum(round((l ->> 'quantity')::numeric))::integer AS qty
          FROM jsonb_array_elements(v_inv.items) l
         WHERE coalesce(l ->> 'sku', '') <> '' AND coalesce(l ->> 'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
         GROUP BY 1
      ) g
      JOIN public.product_variants pv ON pv.sku = g.sku
      JOIN public.products p ON p.id = pv.product_id
     WHERE g.qty > 0
     ORDER BY pv.id
       FOR UPDATE OF pv
  LOOP
    IF v_row.stock_quantity - v_row.reserved_quantity < v_row.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_row.sku, 'required', v_row.qty,
                   'available', greatest(v_row.stock_quantity - v_row.reserved_quantity, 0),
                   'short', v_row.qty - greatest(v_row.stock_quantity - v_row.reserved_quantity, 0))::text;
    END IF;

    UPDATE public.product_variants SET stock_quantity = stock_quantity - v_row.qty, updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      v_row.id, v_row.product_id, v_row.sku, v_row.title, 'INVOICE_ISSUED',
      -v_row.qty, v_row.stock_quantity, v_row.stock_quantity - v_row.qty, v_inv.invoice_number,
      'Stock reduced for invoice ' || v_inv.invoice_number, p_actor
    );
    v_moved := v_moved + 1;
  END LOOP;

  UPDATE public.invoices SET stock_posted_at = now(), stock_reversed_at = NULL WHERE id = v_inv.id;
  RETURN jsonb_build_object('posted', true, 'invoice_number', v_inv.invoice_number, 'skus', v_moved);
END;
$$;

-- reverse_invoice_stock: give the units back (invoice cancelled). At most once.
CREATE OR REPLACE FUNCTION public.reverse_invoice_stock(
  p_invoice_id uuid, p_actor uuid DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_row record;
  v_moved integer := 0;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.stock_owner <> 'invoice' OR v_inv.stock_posted_at IS NULL OR v_inv.stock_reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('reversed', false, 'invoice_number', v_inv.invoice_number);
  END IF;

  FOR v_row IN
    SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, p.title, g.qty
      FROM (
        SELECT l ->> 'sku' AS sku, sum(round((l ->> 'quantity')::numeric))::integer AS qty
          FROM jsonb_array_elements(v_inv.items) l
         WHERE coalesce(l ->> 'sku', '') <> '' AND coalesce(l ->> 'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
         GROUP BY 1
      ) g
      JOIN public.product_variants pv ON pv.sku = g.sku
      JOIN public.products p ON p.id = pv.product_id
     WHERE g.qty > 0
     ORDER BY pv.id
       FOR UPDATE OF pv
  LOOP
    UPDATE public.product_variants SET stock_quantity = stock_quantity + v_row.qty, updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      v_row.id, v_row.product_id, v_row.sku, v_row.title, 'INVOICE_CANCELLED',
      v_row.qty, v_row.stock_quantity, v_row.stock_quantity + v_row.qty, v_inv.invoice_number,
      'Stock returned: invoice ' || v_inv.invoice_number || ' cancelled'
        || coalesce(' (' || nullif(btrim(p_reason), '') || ')', ''),
      p_actor
    );
    v_moved := v_moved + 1;
  END LOOP;

  UPDATE public.invoices SET stock_reversed_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object('reversed', true, 'invoice_number', v_inv.invoice_number, 'skus', v_moved);
END;
$$;

-- repost_invoice_stock: an edited invoice changes stock by the difference only.
-- The caller passes both the old and the new lines (the invoice row may or may not have been
-- saved yet), so the same call also undoes an edit: swap old and new.
-- No-op for invoices that don't own their stock or whose stock isn't currently posted.
CREATE OR REPLACE FUNCTION public.repost_invoice_stock(
  p_invoice_id uuid, p_actor uuid DEFAULT NULL,
  p_old_items jsonb DEFAULT '[]'::jsonb, p_new_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_row record;
  v_moved integer := 0;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.stock_owner <> 'invoice' OR v_inv.stock_posted_at IS NULL OR v_inv.stock_reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('adjusted', false, 'invoice_number', v_inv.invoice_number);
  END IF;

  FOR v_row IN
    SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, pv.reserved_quantity, p.title,
           (coalesce(n.qty, 0) - coalesce(o.qty, 0)) AS delta
      FROM (
        SELECT l ->> 'sku' AS sku, sum(round((l ->> 'quantity')::numeric))::integer AS qty
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_old_items) = 'array' THEN p_old_items ELSE '[]'::jsonb END) l
         WHERE coalesce(l ->> 'sku', '') <> '' AND coalesce(l ->> 'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
         GROUP BY 1
      ) o
      FULL JOIN (
        SELECT l ->> 'sku' AS sku, sum(round((l ->> 'quantity')::numeric))::integer AS qty
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_new_items) = 'array' THEN p_new_items ELSE '[]'::jsonb END) l
         WHERE coalesce(l ->> 'sku', '') <> '' AND coalesce(l ->> 'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
         GROUP BY 1
      ) n ON n.sku = o.sku
      JOIN public.product_variants pv ON pv.sku = coalesce(n.sku, o.sku)
      JOIN public.products p ON p.id = pv.product_id
     WHERE coalesce(n.qty, 0) <> coalesce(o.qty, 0)
     ORDER BY pv.id
       FOR UPDATE OF pv
  LOOP
    IF v_row.delta > 0 AND v_row.stock_quantity - v_row.reserved_quantity < v_row.delta THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('sku', v_row.sku, 'required', v_row.delta,
                   'available', greatest(v_row.stock_quantity - v_row.reserved_quantity, 0),
                   'short', v_row.delta - greatest(v_row.stock_quantity - v_row.reserved_quantity, 0))::text;
    END IF;

    UPDATE public.product_variants SET stock_quantity = stock_quantity - v_row.delta, updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      v_row.id, v_row.product_id, v_row.sku, v_row.title, 'INVOICE_EDITED',
      -v_row.delta, v_row.stock_quantity, v_row.stock_quantity - v_row.delta, v_inv.invoice_number,
      'Invoice ' || v_inv.invoice_number || ' edited (' || CASE WHEN v_row.delta > 0 THEN '+' ELSE '' END || v_row.delta || ' units sold)',
      p_actor
    );
    v_moved := v_moved + 1;
  END LOOP;

  RETURN jsonb_build_object('adjusted', true, 'invoice_number', v_inv.invoice_number, 'skus', v_moved);
END;
$$;

-- 6. Privileges: server-only, like the other stock functions ---------------------------------
REVOKE ALL ON FUNCTION public.check_invoice_stock(jsonb)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_invoice_stock(uuid, uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_invoice_stock(uuid, uuid, text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repost_invoice_stock(uuid, uuid, jsonb, jsonb)    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_invoice_stock(jsonb)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.post_invoice_stock(uuid, uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_invoice_stock(uuid, uuid, text)       TO service_role;
GRANT EXECUTE ON FUNCTION public.repost_invoice_stock(uuid, uuid, jsonb, jsonb) TO service_role;

COMMIT;
