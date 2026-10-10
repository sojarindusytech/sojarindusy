-- Migration: 20261011_purchase_order_numbering.sql
-- Sequential, financial-year purchase order numbers (same scheme as invoices),
-- configurable in sales_settings. Requires 20261010_invoices_and_sales_settings.sql.

ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS po_prefix text NOT NULL DEFAULT 'SI/PO',
  ADD COLUMN IF NOT EXISTS po_fy text,
  ADD COLUMN IF NOT EXISTS po_next_number integer NOT NULL DEFAULT 1 CHECK (po_next_number >= 1),
  ADD COLUMN IF NOT EXISTS po_pad integer NOT NULL DEFAULT 2 CHECK (po_pad BETWEEN 1 AND 8);

-- Atomic: one UPDATE row-locks sales_settings, so concurrent callers (several SKUs
-- can cross their trigger in the same order) always get distinct numbers.
-- Financial year runs April to March (IST); on rollover the counter restarts at 1.
CREATE OR REPLACE FUNCTION public.next_po_number()
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
  SET po_next_number = CASE WHEN po_fy IS DISTINCT FROM cur_fy THEN 2 ELSE po_next_number + 1 END,
      po_fy = cur_fy,
      updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  RETURN s.po_prefix || '/' || s.po_fy || '/' || lpad((s.po_next_number - 1)::text, s.po_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_po_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_po_number() TO service_role;
