-- Migration: 20261013_quotes.sql
-- Real quotations table (replaces the in-memory demo data), financial-year quote
-- numbers, and quote defaults in sales_settings.
-- Requires 20261010_invoices_and_sales_settings.sql.

ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS quote_prefix text NOT NULL DEFAULT 'SI/QT',
  ADD COLUMN IF NOT EXISTS quote_fy text,
  ADD COLUMN IF NOT EXISTS quote_next_number integer NOT NULL DEFAULT 1 CHECK (quote_next_number >= 1),
  ADD COLUMN IF NOT EXISTS quote_pad integer NOT NULL DEFAULT 2 CHECK (quote_pad BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS quote_validity_days integer NOT NULL DEFAULT 30 CHECK (quote_validity_days BETWEEN 1 AND 365),
  ADD COLUMN IF NOT EXISTS quote_payment_terms text,
  ADD COLUMN IF NOT EXISTS quote_delivery_terms text;

-- Atomic: one UPDATE row-locks sales_settings, so concurrent callers always get distinct numbers.
-- Financial year runs April to March (IST); on rollover the counter restarts at 1.
CREATE OR REPLACE FUNCTION public.next_quote_number()
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
  SET quote_next_number = CASE WHEN quote_fy IS DISTINCT FROM cur_fy THEN 2 ELSE quote_next_number + 1 END,
      quote_fy = cur_fy,
      updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  RETURN s.quote_prefix || '/' || s.quote_fy || '/' || lpad((s.quote_next_number - 1)::text, s.quote_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_quote_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO service_role;

-- Quotations. customer / items / totals are snapshots, like invoices.
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  quote_fy text,
  seq integer, -- NULL when the number was typed manually
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL,
  company_name text NOT NULL,
  contact_person text,
  email text,
  mobile text,
  gstin text,
  address text,
  place_of_supply text,
  gst_enabled boolean NOT NULL DEFAULT true,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,      -- taxable amount after discounts
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_in_words text,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])),
  payment_terms text,
  delivery_terms text,
  admin_notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quotes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_rfq_id ON public.quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Customers can read own sent quotes" ON public.quotes;

CREATE POLICY "Service role full access on quotes"
  ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A customer sees their own quotes once they have been sent (never drafts).
CREATE POLICY "Customers can read own sent quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status <> 'draft');
