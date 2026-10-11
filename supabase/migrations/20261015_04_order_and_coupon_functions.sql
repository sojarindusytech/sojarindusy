-- =============================================================================
-- 20261015_04_order_and_coupon_functions.sql
-- Transactional database functions for orders, stock and coupons.
-- =============================================================================
-- WHEN TO RUN: before the app deploy (the new code calls these; the old code
-- does not, so adding them changes nothing until the deploy).
--
-- Every function here does a read-check-write that must not interleave with
-- another request, so each one runs as a single transaction with row locks:
--
--   place_order(jsonb)                  price check, stock check + deduction,
--                                       coupon re-check under lock, order +
--                                       redemption insert. All or nothing.
--   transition_order_status(...)        status rules, restock on cancel/return,
--                                       coupon release on cancel. Locked, so a
--                                       double click cannot restock twice.
--   adjust_variant_stock(...)           manual ADD / SUBTRACT / SET, logged.
--   receive_purchase_order(...)         credits stock exactly once per PO.
--   coupon_checkout_context(text, uuid) everything checkout needs to evaluate a
--                                       code, in one round trip.
--   save_coupon(...)                    coupon + its eligibility lists, atomically.
--   remove_coupon(uuid)                 delete if never used, otherwise archive.
--   coupon_usage_summary(uuid[])        use counts for the admin list.
--
-- SECURITY: all run with the caller's rights (SECURITY INVOKER) and are
-- executable by service_role only. The app calls them from Server Actions
-- after its own auth checks; anon / authenticated cannot call them at all.
--
-- ERRORS: business failures raise SQLSTATE P0001 with a stable code in the
-- message (e.g. COUPON_LIMIT_REACHED) and optional JSON in DETAIL. The app
-- maps the code to a user-facing message.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- place_order
-- -----------------------------------------------------------------------------
-- Input (built by the server, never by the browser):
-- {
--   "user_id":          uuid,
--   "idempotency_key":  uuid,               one per checkout attempt
--   "shipping_address": text,
--   "notes":            text | null,
--   "customer_details": object,             snapshot shown on the order
--   "tax": { "gst_enabled": bool, "intra_state": bool,
--            "seller_state_code": text | null, "place_of_supply": text | null },
--   "items": [{ "variant_id": uuid, "quantity": int, "unit_price": numeric,
--               "name": text, "specifications": object,
--               "discount_amount": numeric,  this line's share of the coupon
--               "gst_rate": numeric,         effective GST % (0 when GST is off)
--               "cgst": numeric, "sgst": numeric, "igst": numeric }],
--   "discount_amount":  numeric,            0 without a coupon; = sum of line discounts
--   "coupon":           { "coupon_id": uuid, "version": int } | null
-- }
-- unit_price is the price the server showed; it must equal list_price now,
-- otherwise PRICE_CHANGED and the customer sees the new price before paying it.
--
-- GST is worked out by the app per line, with the same maths as the tax
-- invoice (src/lib/order-pricing.ts), so the invoice raised on delivery matches
-- the order to the paisa. This function checks those amounts are consistent
-- (discount within the line, tax = rate x taxable value, CGST/SGST vs IGST)
-- and stores them; the totals are summed here from the checked lines.
--
-- Backorders are a business feature: a customer may order more than is in
-- stock (the storefront tells them the extra ships later). Only the units on
-- hand are reserved; each order line records reserved_quantity and
-- backordered_quantity, so a cancellation puts back exactly what was taken.
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

    SELECT pv.id, pv.product_id, pv.sku, pv.list_price, pv.stock_quantity,
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
    v_reserved := least(v_variant.stock_quantity, v_qty);

    IF v_reserved > 0 THEN
      UPDATE public.product_variants
         SET stock_quantity = stock_quantity - v_reserved,
             updated_at     = now()
       WHERE id = v_variant.id;

      INSERT INTO public.inventory_logs (
        variant_id, product_id, sku_code, product_title, movement_type,
        quantity_delta, balance_before, balance_after, reference_id, notes, created_by
      ) VALUES (
        v_variant.id, v_variant.product_id, v_variant.sku, v_variant.title, 'ORDER_RESERVATION',
        -v_reserved, v_variant.stock_quantity, v_variant.stock_quantity - v_reserved, v_order_number,
        'Auto-reserved for ' || v_company
          || CASE WHEN v_qty > v_reserved
                  THEN format(' (%s more on backorder)', v_qty - v_reserved) ELSE '' END,
        v_user_id
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
      'stock_after', v_variant.stock_quantity - v_reserved,
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

-- -----------------------------------------------------------------------------
-- transition_order_status
-- -----------------------------------------------------------------------------
-- Rules (anything else raises INVALID_TRANSITION / ORDER_CLOSED):
--   * cancelled and returned are final; nothing moves out of them.
--   * delivered can only move to returned.
--   * returned is only reachable from shipped or delivered.
--   * pending / confirmed / processing / shipped can move between each other,
--     or to delivered or cancelled.
--   * Same status = a details-only update (tracking number, notes).
-- Side effects, applied exactly once because the order row is locked:
--   * -> shipped:    dispatched_at stamped
--   * -> delivered:  delivered_at stamped (the app then raises the tax invoice
--                    and records its number on the order)
--   * -> cancelled:  the reserved units go back to stock (backordered units were
--                    never taken), coupon use released
--   * -> returned:   every unit goes back to stock, returned_at stamped
--                    (coupon use kept)
-- p_changes keys (all optional): courier_partner, awb_number, tracking_url,
-- notes, return_reason. An empty string clears the field.
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

  -- Restock exactly once: only on the move INTO cancelled / returned.
  IF v_old <> p_new_status AND p_new_status IN ('cancelled', 'returned') THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) LOOP
      -- Legacy lines without a real SKU id ("item-1") have no stock to restore.
      CONTINUE WHEN coalesce(v_item ->> 'id', '') !~* c_uuid_re;
      CONTINUE WHEN coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]+)?$';
      v_qty := round((v_item ->> 'quantity')::numeric)::integer;
      -- A cancelled order never shipped, so only what it reserved goes back.
      -- Orders placed before reserved_quantity existed reserved everything.
      IF p_new_status = 'cancelled'
         AND coalesce(v_item ->> 'reserved_quantity', '') ~ '^[0-9]+$' THEN
        v_qty := (v_item ->> 'reserved_quantity')::integer;
      END IF;
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
        CASE WHEN p_new_status = 'cancelled'
             THEN 'Restocked after order cancellation'
             ELSE 'Customer return restocked: ' || coalesce(v_order.return_reason, 'Goods returned to warehouse')
        END,
        p_actor
      );
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

-- -----------------------------------------------------------------------------
-- adjust_variant_stock: manual stock change by an admin
-- -----------------------------------------------------------------------------
-- p_mode: ADD | SUBTRACT (never below 0) | SET. Locked and logged in one step.
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

  SELECT pv.id, pv.product_id, pv.sku, pv.stock_quantity, p.title
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

-- -----------------------------------------------------------------------------
-- receive_purchase_order: credit stock exactly once
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_notes text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_po    public.purchase_orders%ROWTYPE;
  v_after integer;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_po.status = 'Received' THEN
    RETURN jsonb_build_object('already_received', true, 'order_number', v_po.order_number);
  END IF;

  UPDATE public.product_variants
     SET stock_quantity = stock_quantity + v_po.order_quantity, updated_at = now()
   WHERE id = v_po.variant_id
  RETURNING stock_quantity INTO v_after;

  IF FOUND THEN
    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      v_po.variant_id, v_po.product_id, v_po.sku_code, v_po.product_title, 'RESTOCK',
      v_po.order_quantity, v_after - v_po.order_quantity, v_after, v_po.order_number,
      CASE WHEN nullif(btrim(coalesce(p_notes, '')), '') IS NOT NULL
           THEN 'Auto PO Receipt: ' || btrim(p_notes)
           ELSE 'Auto Purchase Order ' || v_po.order_number || ' received from Manufacturer'
      END,
      p_actor
    );
  END IF;

  UPDATE public.purchase_orders
     SET status      = 'Received',
         received_at = now(),
         notes       = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
         updated_at  = now()
   WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'already_received', false,
    'order_number',     v_po.order_number,
    'sku',              v_po.sku_code,
    'quantity',         v_po.order_quantity,
    'stock_after',      v_after
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- coupon_checkout_context: everything needed to evaluate a code, in one call
-- -----------------------------------------------------------------------------
-- Returns NULL when no live coupon has this code. category_ids is expanded to
-- every sub-category, so a coupon on "Drills" also covers its children.
CREATE OR REPLACE FUNCTION public.coupon_checkout_context(p_code text, p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH RECURSIVE
  c AS (
    SELECT * FROM public.coupons
     WHERE code = upper(btrim(p_code)) AND deleted_at IS NULL
  ),
  tree AS (
    SELECT cc.category_id AS id
      FROM public.coupon_categories cc
      JOIN c ON c.id = cc.coupon_id
    UNION
    SELECT ch.id
      FROM public.categories ch
      JOIN tree t ON ch.parent_id = t.id
  )
  SELECT jsonb_build_object(
    'coupon',            to_jsonb(c.*),
    'product_ids',       coalesce((SELECT jsonb_agg(cp.product_id) FROM public.coupon_products cp
                                    WHERE cp.coupon_id = c.id), '[]'::jsonb),
    'category_ids',      coalesce((SELECT jsonb_agg(tree.id) FROM tree), '[]'::jsonb),
    'customer_allowed',  c.customer_scope = 'all' OR EXISTS (
                           SELECT 1 FROM public.coupon_customers cu
                            WHERE cu.coupon_id = c.id AND cu.user_id = p_user_id),
    'total_uses',        (SELECT count(*) FROM public.coupon_redemptions r
                           WHERE r.coupon_id = c.id
                             AND (r.status = 'applied' OR (r.status = 'reserved' AND r.expires_at > now()))),
    'customer_uses',     (SELECT count(*) FROM public.coupon_redemptions r
                           WHERE r.coupon_id = c.id AND r.user_id = p_user_id
                             AND (r.status = 'applied' OR (r.status = 'reserved' AND r.expires_at > now()))),
    'has_prior_orders',  EXISTS (SELECT 1 FROM public.orders o
                                  WHERE o.user_id = p_user_id AND o.status <> 'cancelled')
  )
  FROM c;
$$;

-- -----------------------------------------------------------------------------
-- save_coupon: create or update a coupon and its eligibility lists atomically
-- -----------------------------------------------------------------------------
-- p_coupon carries the coupon fields (validated by the app first; the table's
-- CHECK constraints are the backstop). For an update, pass "id" and the
-- "version" the admin loaded: if someone else saved in between, COUPON_CHANGED.
CREATE OR REPLACE FUNCTION public.save_coupon(
  p_coupon       jsonb,
  p_product_ids  uuid[] DEFAULT '{}',
  p_category_ids uuid[] DEFAULT '{}',
  p_customer_ids uuid[] DEFAULT '{}',
  p_actor        uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id      uuid := nullif(p_coupon ->> 'id', '')::uuid;
  v_version integer;
BEGIN
  IF v_id IS NULL THEN
    INSERT INTO public.coupons (
      code, description, discount_type, discount_value, max_discount, min_order_value,
      valid_from, valid_until, max_total_uses, max_uses_per_customer, first_order_only,
      can_combine, applies_to, customer_scope, is_active, created_by
    ) VALUES (
      upper(btrim(p_coupon ->> 'code')),
      nullif(btrim(coalesce(p_coupon ->> 'description', '')), ''),
      p_coupon ->> 'discount_type',
      (p_coupon ->> 'discount_value')::numeric,
      (p_coupon ->> 'max_discount')::numeric,
      coalesce((p_coupon ->> 'min_order_value')::numeric, 0),
      coalesce((p_coupon ->> 'valid_from')::timestamptz, now()),
      (p_coupon ->> 'valid_until')::timestamptz,
      (p_coupon ->> 'max_total_uses')::integer,
      (p_coupon ->> 'max_uses_per_customer')::integer,
      coalesce((p_coupon ->> 'first_order_only')::boolean, false),
      coalesce((p_coupon ->> 'can_combine')::boolean, false),
      coalesce(p_coupon ->> 'applies_to', 'all'),
      coalesce(p_coupon ->> 'customer_scope', 'all'),
      coalesce((p_coupon ->> 'is_active')::boolean, true),
      p_actor
    )
    RETURNING id, version INTO v_id, v_version;
  ELSE
    UPDATE public.coupons c SET
      code                  = upper(btrim(p_coupon ->> 'code')),
      description           = nullif(btrim(coalesce(p_coupon ->> 'description', '')), ''),
      discount_type         = p_coupon ->> 'discount_type',
      discount_value        = (p_coupon ->> 'discount_value')::numeric,
      max_discount          = (p_coupon ->> 'max_discount')::numeric,
      min_order_value       = coalesce((p_coupon ->> 'min_order_value')::numeric, 0),
      valid_from            = coalesce((p_coupon ->> 'valid_from')::timestamptz, c.valid_from),
      valid_until           = (p_coupon ->> 'valid_until')::timestamptz,
      max_total_uses        = (p_coupon ->> 'max_total_uses')::integer,
      max_uses_per_customer = (p_coupon ->> 'max_uses_per_customer')::integer,
      first_order_only      = coalesce((p_coupon ->> 'first_order_only')::boolean, false),
      can_combine           = coalesce((p_coupon ->> 'can_combine')::boolean, false),
      applies_to            = coalesce(p_coupon ->> 'applies_to', 'all'),
      customer_scope        = coalesce(p_coupon ->> 'customer_scope', 'all'),
      is_active             = coalesce((p_coupon ->> 'is_active')::boolean, true)
    WHERE c.id = v_id
      AND c.deleted_at IS NULL
      AND (p_coupon ->> 'version' IS NULL OR c.version = (p_coupon ->> 'version')::integer)
    RETURNING c.version INTO v_version;

    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.coupons WHERE id = v_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'COUPON_CHANGED' USING ERRCODE = 'P0001';
      END IF;
      RAISE EXCEPTION 'COUPON_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    DELETE FROM public.coupon_products   WHERE coupon_id = v_id;
    DELETE FROM public.coupon_categories WHERE coupon_id = v_id;
    DELETE FROM public.coupon_customers  WHERE coupon_id = v_id;
  END IF;

  INSERT INTO public.coupon_products (coupon_id, product_id)
  SELECT DISTINCT v_id, x FROM unnest(coalesce(p_product_ids, '{}'::uuid[])) AS x;

  INSERT INTO public.coupon_categories (coupon_id, category_id)
  SELECT DISTINCT v_id, x FROM unnest(coalesce(p_category_ids, '{}'::uuid[])) AS x;

  INSERT INTO public.coupon_customers (coupon_id, user_id)
  SELECT DISTINCT v_id, x FROM unnest(coalesce(p_customer_ids, '{}'::uuid[])) AS x;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END;
$$;

-- -----------------------------------------------------------------------------
-- remove_coupon: delete a never-used coupon; archive a used one
-- -----------------------------------------------------------------------------
-- Archiving keeps the row that redemptions and order history point at, and
-- frees the code for reuse. Locked so an in-flight checkout either finishes
-- first or sees the coupon gone.
CREATE OR REPLACE FUNCTION public.remove_coupon(p_coupon_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.coupons WHERE id = p_coupon_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COUPON_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = p_coupon_id) THEN
    UPDATE public.coupons SET deleted_at = now(), is_active = false WHERE id = p_coupon_id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.coupons WHERE id = p_coupon_id;
  RETURN 'deleted';
END;
$$;

-- -----------------------------------------------------------------------------
-- coupon_usage_summary: counts for the admin list
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coupon_usage_summary(p_coupon_ids uuid[])
RETURNS TABLE (coupon_id uuid, active_uses bigint, released_uses bigint, total_discount numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT r.coupon_id,
         count(*) FILTER (WHERE r.status = 'applied'
                             OR (r.status = 'reserved' AND r.expires_at > now())),
         count(*) FILTER (WHERE r.status = 'released'),
         coalesce(sum(r.discount_amount) FILTER (WHERE r.status = 'applied'), 0)
    FROM public.coupon_redemptions r
   WHERE r.coupon_id = ANY (p_coupon_ids)
   GROUP BY r.coupon_id;
$$;

-- -----------------------------------------------------------------------------
-- Grants: server only
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.place_order(jsonb)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_order_status(uuid, text, jsonb, uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_variant_stock(uuid, text, integer, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid, text, uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coupon_checkout_context(text, uuid)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_coupon(jsonb, uuid[], uuid[], uuid[], uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_coupon(uuid)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coupon_usage_summary(uuid[])                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_coupons_touch()                                          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb)                                         TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, jsonb, uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_variant_stock(uuid, text, integer, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, text, uuid)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.coupon_checkout_context(text, uuid)                         TO service_role;
GRANT EXECUTE ON FUNCTION public.save_coupon(jsonb, uuid[], uuid[], uuid[], uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_coupon(uuid)                                         TO service_role;
GRANT EXECUTE ON FUNCTION public.coupon_usage_summary(uuid[])                                TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_coupons_touch()                                          TO service_role;

COMMIT;
