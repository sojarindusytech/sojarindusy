-- =============================================================================
-- 20261022_order_number_padding.sql
-- Fix: order numbers (20261019_order_numbering) broke after the 99th order of a year.
-- =============================================================================
-- Requires 20261019_01_document_number_padding and 20261019_order_numbering.
-- Safe to run more than once.
--
-- next_order_number() padded with lpad(n, pad, '0'), which TRUNCATES a longer
-- number: with 2 digits the 100th order became ".../10", the same as the 10th.
-- Checkout asks for a number on every order, so from then on every checkout
-- failed on the duplicate. Also, rename_order lets an admin type a number that
-- the series later reaches, which would block checkout the same way.
--
-- Now orders use the shared next_series_number() (pads, never cuts) and skip any
-- number already taken. next_document_number keeps 20261019's behaviour ('ORD'
-- uses the Sales Settings series) but no longer cuts its 5-digit fallback.
-- Numbers already issued are unchanged.
-- =============================================================================

BEGIN;

-- Same as 20261019_01, with 'order' added to the known series.
CREATE OR REPLACE FUNCTION public.next_series_number(p_series text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ist        timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  start_year integer;
  cur_fy     text;
  v_prefix   text;
  v_fy       text;
  v_next     integer;
  v_pad      integer;
  v_seq      text;
BEGIN
  -- Column names are built from p_series: only known series are allowed.
  IF p_series IS NULL OR p_series NOT IN ('invoice', 'po', 'rfq', 'quote', 'receipt', 'debit_note', 'order') THEN
    RAISE EXCEPTION 'INVALID_SERIES' USING ERRCODE = 'P0001';
  END IF;

  start_year := EXTRACT(YEAR FROM ist)::integer;
  IF EXTRACT(MONTH FROM ist) < 4 THEN
    start_year := start_year - 1;
  END IF;
  cur_fy := lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');

  EXECUTE format(
    'UPDATE public.sales_settings
        SET %1$I = CASE WHEN %2$I IS DISTINCT FROM $1 THEN 2 ELSE %1$I + 1 END,
            %2$I = $1,
            updated_at = now()
      WHERE id = true
      RETURNING %3$I, %2$I, %1$I, %4$I',
    p_series || '_next_number', p_series || '_fy', p_series || '_prefix', p_series || '_pad')
  INTO v_prefix, v_fy, v_next, v_pad
  USING cur_fy;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  -- Pad to at least v_pad digits, never cut a longer number.
  v_seq := (v_next - 1)::text;
  RETURN v_prefix || '/' || v_fy || '/' || lpad(v_seq, greatest(v_pad, length(v_seq)), '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_series_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_series_number(text) TO service_role;

-- The next free order number. Runs inside place_order's transaction, so a failed
-- order rolls its number (and any skipped ones) back with it.
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_tries  integer := 0;
BEGIN
  LOOP
    v_number := public.next_series_number('order');
    -- Skip a number an admin already gave an order by hand (rename_order).
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_number);
    v_tries := v_tries + 1;
    IF v_tries >= 1000 THEN
      RAISE EXCEPTION 'ORDER_NUMBERING_EXHAUSTED' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.next_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO service_role;

-- As in 20261019_order_numbering ('ORD' uses the Sales Settings series), with the
-- year-counter fallback padded without truncation.
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

  RETURN format('%s-%s-%s', p_doc_type, v_year, lpad(v_value::text, greatest(5, length(v_value::text)), '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO service_role;

COMMIT;
