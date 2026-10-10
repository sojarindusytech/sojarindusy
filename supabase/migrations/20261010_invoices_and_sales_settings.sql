-- Migration: 20261010_invoices_and_sales_settings.sql
-- Invoice module: per-SKU GST/HSN, single-row sales settings, invoices table,
-- and an atomic financial-year invoice number generator.

-- 1. Per-SKU GST rate and HSN code. NULL = fall back to sales_settings defaults.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) CHECK (gst_rate IS NULL OR (gst_rate >= 0 AND gst_rate <= 100)),
  ADD COLUMN IF NOT EXISTS hsn_code text;

COMMENT ON COLUMN public.product_variants.gst_rate IS 'GST % for this SKU. NULL uses sales_settings.default_gst_rate.';
COMMENT ON COLUMN public.product_variants.hsn_code IS 'HSN/SAC code for this SKU. NULL prints a blank HSN on the invoice.';

-- 2. Sales settings (exactly one row, enforced by the boolean primary key).
CREATE TABLE IF NOT EXISTS public.sales_settings (
  id boolean NOT NULL DEFAULT true CHECK (id),
  -- Seller
  company_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  gstin text,
  state_code text NOT NULL DEFAULT '24',
  state_name text NOT NULL DEFAULT 'Gujarat',
  msme text,
  website text,
  phone text,
  email text,
  logo_url text,
  signature_url text,
  -- Bank & terms
  bank_name text,
  bank_address text,
  account_no text,
  ifsc text,
  account_holder text,
  terms text,
  -- Billing
  gst_billing_enabled boolean NOT NULL DEFAULT true,
  default_gst_rate numeric(5,2) NOT NULL DEFAULT 18 CHECK (default_gst_rate >= 0 AND default_gst_rate <= 100),
  -- Numbering: <prefix>/<fy>/<zero-padded counter>, e.g. SI/INV/25-26/04
  invoice_prefix text NOT NULL DEFAULT 'SI/INV',
  invoice_fy text,
  invoice_next_number integer NOT NULL DEFAULT 1 CHECK (invoice_next_number >= 1),
  invoice_pad integer NOT NULL DEFAULT 2 CHECK (invoice_pad BETWEEN 1 AND 8),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_settings_pkey PRIMARY KEY (id)
);

INSERT INTO public.sales_settings (
  id, company_name, address, gstin, state_code, state_name, msme, website, phone, email,
  bank_name, bank_address, account_no, ifsc, account_holder, terms
) VALUES (
  true,
  'SOJAR SOLUTIONS',
  E'PLOT NO.7, BEHIND HOTEL LA CARTA, NEAR SILVASSA ROADLINES, N.H.NO.48, CHAR RASTA, VAPI, TA.VAPI, DIST.VALSAD-396191, GUJARAT, INDIA.',
  '24APTPS7235R1ZR', '24', 'Gujarat', 'UDYAM-GJ-25-0021489', 'www.sojarindusy.com', '+919820701219', 'sojarindusy@gmail.com',
  'HDFC BANK LTD.',
  'OFFICE NO. 1 & 2, 1ST FLOOR, DEEP APARTMENT, BELOW JAY INTERNATIONAL HOTEL, GIDC CHAR RASTA, VAPI-396195, GUJARAT (INDIA)',
  '50200075315170', 'HDFC0002761', 'SOJAR INDUSY',
  E'THANK YOU FOR YOUR BUSINESS!\nWe truly value your trust.\n\nPlease note that a @24% per annum interest rate may apply to payments not received by the due date.\n\nGoods are non-returnable unless defective or damaged on delivery. Report defects within 7 days with proof.\n\nAll details in this Invoice, including pricing, are accurate and reflect the final amount charged, with no additional consideration involved.\n\nAll transactions are subject to VAPI jurisdiction.'
) ON CONFLICT (id) DO NOTHING;

-- Which copies print on the invoice PDF, one set of pages per copy.
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS invoice_copies text[] NOT NULL DEFAULT ARRAY['original']::text[];
ALTER TABLE public.sales_settings DROP CONSTRAINT IF EXISTS sales_settings_invoice_copies_check;
ALTER TABLE public.sales_settings
  ADD CONSTRAINT sales_settings_invoice_copies_check
  CHECK (invoice_copies <@ ARRAY['original','duplicate','triplicate']::text[] AND cardinality(invoice_copies) >= 1);

-- An earlier draft had a default HSN setting; HSN is per SKU only.
ALTER TABLE public.sales_settings DROP COLUMN IF EXISTS default_hsn;

-- 3. Invoices. bill_to / items / totals are snapshots: later price or profile
-- edits must never rewrite an issued invoice.
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_fy text,
  seq integer, -- NULL when the number was typed manually
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  po_number text,
  place_of_supply text,
  gst_enabled boolean NOT NULL DEFAULT true,
  bill_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_in_words text,
  status text NOT NULL DEFAULT 'issued' CHECK (status = ANY (ARRAY['issued'::text, 'cancelled'::text])),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

-- One invoice per order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_order_id ON public.invoices(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date DESC);

-- 4. RLS. All admin access goes through server actions on the service-role client.
ALTER TABLE public.sales_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on sales_settings" ON public.sales_settings;
DROP POLICY IF EXISTS "Service role full access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers can read own invoices" ON public.invoices;

CREATE POLICY "Service role full access on sales_settings"
  ON public.sales_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on invoices"
  ON public.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Customers can read own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'issued');

-- 5. Atomic invoice number generator. A single UPDATE row-locks sales_settings,
-- so concurrent callers always get distinct numbers. The financial year runs
-- April to March (IST); when it rolls over the counter restarts at 1.
CREATE OR REPLACE FUNCTION public.next_invoice_number()
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
  SET invoice_next_number = CASE WHEN invoice_fy IS DISTINCT FROM cur_fy THEN 2 ELSE invoice_next_number + 1 END,
      invoice_fy = cur_fy,
      updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  RETURN s.invoice_prefix || '/' || s.invoice_fy || '/' || lpad((s.invoice_next_number - 1)::text, s.invoice_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- 6. Public bucket for invoice logo / signature. @react-pdf only renders PNG/JPEG.
-- Uploads go through a server action on the service-role client, so only public read is needed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-assets',
  'invoice-assets',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Read Access for Invoice Assets'
  ) THEN
    CREATE POLICY "Public Read Access for Invoice Assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'invoice-assets');
  END IF;
END $$;
