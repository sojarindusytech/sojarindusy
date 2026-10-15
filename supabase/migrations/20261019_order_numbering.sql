-- =============================================================================
-- 20261019_order_numbering.sql
-- Order numbers from Sales Settings (prefix / financial year / counter), and a way for an
-- admin to give an order a typed number. Same scheme as invoices, quotes, POs, RFQs and receipts.
-- =============================================================================
-- Requires 20261010 (sales_settings) and 20261015_02 (next_document_number).
--
--   next_order_number()                 SI/ORD/25-26/01, FY counter, restarts each April
--   next_document_number('ORD')         now returns next_order_number(), so place_order (which asks
--                                       for an 'ORD' number) needs no change. Other types keep the old
--                                       year counter.
--   rename_order(order, number, actor)  admin sets a typed number; counter untouched
--
-- Existing orders keep their numbers (ORD-2026-00001 ...). Only new orders use the new format.
-- =============================================================================

BEGIN;

-- 1. Settings -------------------------------------------------------------------------------
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS order_prefix text NOT NULL DEFAULT 'SI/ORD',
  ADD COLUMN IF NOT EXISTS order_fy text,
  ADD COLUMN IF NOT EXISTS order_next_number integer NOT NULL DEFAULT 1 CHECK (order_next_number >= 1),
  ADD COLUMN IF NOT EXISTS order_pad integer NOT NULL DEFAULT 2 CHECK (order_pad BETWEEN 1 AND 8);

-- 2. Atomic FY counter (one UPDATE row-locks sales_settings, so concurrent checkouts get distinct numbers
--    and a failed order rolls its number back with it) -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ist timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  start_year integer;
  cur_fy text;
  s public.sales_settings;
BEGIN
  start_year := EXTRACT(YEAR FROM ist)::integer;
  IF EXTRACT(MONTH FROM ist) < 4 THEN
    start_year := start_year - 1;
  END IF;
  cur_fy := lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');

  UPDATE public.sales_settings
  SET order_next_number = CASE WHEN order_fy IS DISTINCT FROM cur_fy THEN 2 ELSE order_next_number + 1 END,
      order_fy = cur_fy,
      updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  RETURN s.order_prefix || '/' || s.order_fy || '/' || lpad((s.order_next_number - 1)::text, s.order_pad, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO service_role;

-- 3. place_order asks for next_document_number('ORD'): point that at the Sales Settings counter.
--    Other document types keep the old year counter (document_counters).
CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  -- Business year boundaries follow India time, not UTC.
  v_year  integer := extract(year FROM (now() AT TIME ZONE 'Asia/Kolkata'))::integer;
  v_value bigint;
BEGIN
  IF p_doc_type IS NULL OR p_doc_type !~ '^[A-Z]{2,5}$' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE' USING ERRCODE = 'P0001';
  END IF;

  IF p_doc_type = 'ORD' THEN
    RETURN public.next_order_number();
  END IF;

  INSERT INTO public.document_counters AS dc (doc_type, period_year, last_value)
  VALUES (p_doc_type, v_year, 1)
  ON CONFLICT (doc_type, period_year)
  DO UPDATE SET last_value = dc.last_value + 1
  RETURNING dc.last_value INTO v_value;

  RETURN format('%s-%s-%s', p_doc_type, v_year, lpad(v_value::text, 5, '0'));
END;
$$;
REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO service_role;

-- 4. rename_order: an admin gives an order a typed number ----------------------------------------------------------
-- Errors (SQLSTATE P0001): ADMIN_REQUIRED, INVALID_ORDER_NUMBER, ORDER_NOT_FOUND, DUPLICATE_ORDER_NUMBER.
-- The counter is not touched, so a typed number never skips or repeats an automatic one. The order row is
-- locked, and the unique index on orders.order_number is the final guard against a concurrent duplicate.
CREATE OR REPLACE FUNCTION public.rename_order(p_order_id uuid, p_new_number text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_number text := nullif(btrim(coalesce(p_new_number, '')), '');
  v_order  public.orders%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_number IS NULL OR v_number !~ '^[A-Za-z0-9/_.-]{1,50}$' THEN
    RAISE EXCEPTION 'INVALID_ORDER_NUMBER' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_number = v_number THEN
    RETURN jsonb_build_object('changed', false, 'order_number', v_number, 'previous', v_number);
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_number) THEN
    RAISE EXCEPTION 'DUPLICATE_ORDER_NUMBER' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders SET order_number = v_number, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('changed', true, 'order_number', v_number, 'previous', v_order.order_number,
                            'user_id', v_order.user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rename_order(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_order(uuid, text, uuid) TO service_role;

COMMIT;
