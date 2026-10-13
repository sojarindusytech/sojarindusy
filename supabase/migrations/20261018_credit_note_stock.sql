-- Apply after credit notes and the stock ledger. Existing notes never restock retroactively.
BEGIN;
ALTER TABLE public.sales_settings
  ADD COLUMN credit_note_restores_stock boolean NOT NULL DEFAULT true;
ALTER TABLE public.credit_notes
  ADD COLUMN stock_returns jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(stock_returns) = 'array');

-- Preserve the invoice identity when its display number is edited later.
ALTER TABLE public.inventory_logs
  ADD COLUMN stock_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
CREATE INDEX inventory_logs_stock_invoice_idx ON public.inventory_logs(stock_invoice_id);
UPDATE public.inventory_logs l SET stock_invoice_id = i.id
FROM public.invoices i WHERE l.reference_id = i.invoice_number
  AND l.movement_type IN ('INVOICE_ISSUED', 'INVOICE_EDITED', 'INVOICE_CANCELLED');
CREATE FUNCTION public.link_invoice_stock_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.movement_type IN ('INVOICE_ISSUED', 'INVOICE_EDITED', 'INVOICE_CANCELLED') THEN
    SELECT id INTO NEW.stock_invoice_id FROM public.invoices WHERE invoice_number = NEW.reference_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.link_invoice_stock_log() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER link_invoice_stock_log BEFORE INSERT ON public.inventory_logs
FOR EACH ROW EXECUTE FUNCTION public.link_invoice_stock_log();

-- Durable per-note quantities also let order returns restore only the remainder.
CREATE FUNCTION public.credit_note_order_returns(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(variant_id, qty), '{}'::jsonb)
  FROM (
    SELECT r->>'variantId' AS variant_id, sum((r->>'quantity')::integer) AS qty
    FROM public.credit_notes n
    JOIN public.invoices i ON i.id = n.invoice_id
    CROSS JOIN LATERAL jsonb_array_elements(n.stock_returns) r
    WHERE i.order_id = p_order_id AND i.stock_owner = 'order'
    GROUP BY 1
  ) totals
$$;
REVOKE ALL ON FUNCTION public.credit_note_order_returns(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_order_returns(uuid) TO service_role;

-- Runs inside issue_credit_note's transaction: note, stock and history commit together.
-- That function already locks the invoice and settings. Order-based credits additionally
-- lock the order before variants, serializing against shipment and full returns.
CREATE FUNCTION public.restore_credit_note_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  ord public.orders%ROWTYPE;
  line jsonb;
  variant public.product_variants%ROWTYPE;
  prior numeric;
  qty integer;
  source_qty integer;
  prior_units integer;
  restored jsonb := '{}'::jsonb;
  enabled boolean;
BEGIN
  NEW.stock_returns := '[]'::jsonb;
  SELECT credit_note_restores_stock INTO enabled FROM public.sales_settings WHERE id = true;
  IF NOT coalesce(enabled, false) THEN RETURN NEW; END IF;
  SELECT * INTO inv FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF inv.stock_owner = 'order' THEN
    SELECT * INTO ord FROM public.orders WHERE id = inv.order_id FOR UPDATE;
    IF NOT FOUND OR ord.stock_fulfilled_at IS NULL OR ord.status IN ('returned', 'cancelled') THEN
      RETURN NEW;
    END IF;
    restored := public.credit_note_order_returns(ord.id);
  ELSIF inv.stock_owner <> 'invoice' OR inv.stock_posted_at IS NULL OR inv.stock_reversed_at IS NOT NULL THEN
    -- Includes legacy invoices: do not guess whether their stock ever moved.
    RETURN NEW;
  END IF;

  -- Match only catalogue items. Lock in the same variant order used by shipment/invoicing.
  FOR line IN
    SELECT l FROM jsonb_array_elements(NEW.items) l
    JOIN public.product_variants pv ON pv.sku = l->>'sku'
    WHERE coalesce(l->>'sku', '') <> ''
    ORDER BY pv.id, (l->>'sourceIndex')::integer
  LOOP
    SELECT * INTO variant FROM public.product_variants WHERE sku = line->>'sku' FOR UPDATE;
    -- Cumulative rounding preserves the integer stock model for fractional partial credits.
    SELECT coalesce(sum((r->>'creditedQuantity')::numeric), 0) INTO prior
    FROM public.credit_notes n CROSS JOIN LATERAL jsonb_array_elements(n.stock_returns) r
    WHERE n.invoice_id = inv.id AND (r->>'sourceIndex')::integer = (line->>'sourceIndex')::integer;
    qty := round(prior + (line->>'quantity')::numeric)::integer - round(prior)::integer;
    IF inv.stock_owner = 'invoice' THEN
      -- A SKU typed on an invoice may not have existed when it was posted.
      -- Require a recorded deduction, rather than inventing stock for a later SKU.
      SELECT greatest(0, -coalesce(sum(quantity_delta), 0))::integer INTO source_qty
      FROM public.inventory_logs WHERE variant_id = variant.id AND stock_invoice_id = inv.id
        AND movement_type IN ('INVOICE_ISSUED', 'INVOICE_EDITED');
      SELECT coalesce(sum((r->>'quantity')::integer), 0)::integer INTO prior_units
      FROM public.credit_notes n CROSS JOIN LATERAL jsonb_array_elements(n.stock_returns) r
      WHERE n.invoice_id = inv.id AND r->>'variantId' = variant.id::text;
      SELECT prior_units + coalesce(sum((r->>'quantity')::integer), 0)::integer INTO prior_units
      FROM jsonb_array_elements(NEW.stock_returns) r WHERE r->>'variantId' = variant.id::text;
      qty := least(qty, greatest(0, source_qty - prior_units));
    END IF;
    IF inv.stock_owner = 'order' THEN
      SELECT coalesce(sum(round((l->>'quantity')::numeric)), 0)::integer INTO source_qty
      FROM jsonb_array_elements(ord.items) l WHERE l->>'id' = variant.id::text;
      qty := least(qty, greatest(0, source_qty - coalesce((restored->>variant.id::text)::integer, 0)));
      restored := jsonb_set(restored, ARRAY[variant.id::text],
        to_jsonb(coalesce((restored->>variant.id::text)::integer, 0) + qty));
    END IF;
    NEW.stock_returns := NEW.stock_returns || jsonb_build_array(jsonb_build_object(
      'variantId', variant.id, 'sourceIndex', (line->>'sourceIndex')::integer,
      'creditedQuantity', (line->>'quantity')::numeric, 'quantity', qty));
    CONTINUE WHEN qty <= 0;
    UPDATE public.product_variants SET stock_quantity = stock_quantity + qty, updated_at = now()
    WHERE id = variant.id;
    INSERT INTO public.inventory_logs (
      variant_id, product_id, sku_code, product_title, movement_type,
      quantity_delta, balance_before, balance_after, reference_id, notes, created_by
    ) VALUES (
      variant.id, variant.product_id, variant.sku, line->>'name', 'CREDIT_NOTE_RESTOCK',
      qty, variant.stock_quantity, variant.stock_quantity + qty, NEW.credit_note_number,
      'Stock restored by credit note against invoice ' || inv.invoice_number, NEW.created_by
    );
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.restore_credit_note_stock() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER restore_credit_note_stock BEFORE INSERT ON public.credit_notes
FOR EACH ROW EXECUTE FUNCTION public.restore_credit_note_stock();

-- Retain the stock ledger lifecycle, subtracting units already restored by credit notes.
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
  v_credit_remaining jsonb;
  v_credit_qty integer;
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
  v_credit_remaining := public.credit_note_order_returns(p_order_id);

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
  --   returned                          only units not yet restored by credit notes go back.
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
        -- Consume the credit balance across duplicate SKU lines too.
        v_credit_qty := least(v_qty, coalesce((v_credit_remaining->>(v_item->>'id'))::integer, 0));
        v_credit_remaining := jsonb_set(v_credit_remaining, ARRAY[v_item->>'id'],
          to_jsonb(coalesce((v_credit_remaining->>(v_item->>'id'))::integer, 0) - v_credit_qty));
        v_qty := v_qty - v_credit_qty;
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


COMMIT;
