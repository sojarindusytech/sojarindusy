-- =============================================================================
-- 20261019_01_document_number_padding.sql
-- Fix: document numbers broke after the 99th document of a financial year.
-- =============================================================================
-- Requires 20261010..20261018. Safe to run more than once.
--
-- The numbering functions padded the counter with lpad(n, pad, '0'). Postgres
-- lpad TRUNCATES a longer string, so with the default 2 digits the 100th
-- document became ".../10" (same as the 10th), and every later one collided
-- with an existing number: no new invoice / quote / receipt / PO / RFQ could
-- be numbered for the rest of the year. Website "Download as Quote" uses the
-- auto series, so quotes reach 100 quickly.
--
-- Now one function, next_series_number(series), does the FY counter for every
-- series and pads without ever truncating (99 -> "99", 100 -> "100"). The
-- existing function names stay as thin wrappers, so no app code changes.
-- Numbers already issued are unaffected.
-- =============================================================================

BEGIN;

-- One FY counter per series, stored in sales_settings as
-- <series>_prefix / <series>_fy / <series>_next_number / <series>_pad.
-- Atomic: the single UPDATE row-locks sales_settings, so concurrent callers always
-- get distinct numbers. The financial year runs April to March (IST); when it
-- rolls over the counter restarts at 1.
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
  IF p_series IS NULL OR p_series NOT IN ('invoice', 'po', 'rfq', 'quote', 'receipt', 'debit_note') THEN
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

-- The existing entry points, unchanged for callers.
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_series_number('invoice') $$;

CREATE OR REPLACE FUNCTION public.next_po_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_series_number('po') $$;

CREATE OR REPLACE FUNCTION public.next_rfq_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_series_number('rfq') $$;

CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_series_number('quote') $$;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_series_number('receipt') $$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_po_number()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_rfq_number()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_quote_number()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_po_number()      TO service_role;
GRANT EXECUTE ON FUNCTION public.next_rfq_number()     TO service_role;
GRANT EXECUTE ON FUNCTION public.next_quote_number()   TO service_role;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO service_role;

-- Same truncation in the order-number fallback (ORD-2026-00001): pad, never cut.
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
