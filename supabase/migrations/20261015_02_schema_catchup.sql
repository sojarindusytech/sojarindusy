-- =============================================================================
-- 20261015_02_schema_catchup.sql
-- Bring the migrations in line with what the code already uses, and add
-- collision-free order numbering.
-- =============================================================================
-- WHEN TO RUN: before the app deploy. Additive only: no existing column is
-- changed or dropped, so the currently deployed code keeps working.
--
--   1. orders.invoice_number / returned_at / return_reason (used, never migrated)
--   2. document_counters + next_document_number(): order numbers (ORD-2026-00001).
--      PO, RFQ, quote and invoice numbers come from the next_*_number()
--      functions in the 20261010-20261013 migrations (sales_settings counters).
--   3. rfqs table (used by the app, never migrated; created by hand in the
--      live project). quotes is owned by 20261013_quotes.sql.
--   4. At most one open AUTOMATIC purchase order per SKU (stops duplicate
--      auto-POs when two orders drain stock at once; manual POs are not limited)
--   5. Stock can no longer go below zero
--
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- 1. Orders: columns the code reads and writes -------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS returned_at    timestamptz,
  ADD COLUMN IF NOT EXISTS return_reason  text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_key
  ON public.orders (invoice_number)
  WHERE invoice_number IS NOT NULL;

-- 2. Order numbers -------------------------------------------------------------------
-- Replaces "year + 4 random digits", which collides after a few hundred orders
-- a year. The counter row is updated under a row lock, so concurrent checkouts
-- always get distinct numbers, and it rolls back with a failed order (no gaps).
-- New numbers have 5+ digits (ORD-2026-00001), so they can never equal a legacy
-- 4-digit number (ORD-2026-4821).
CREATE TABLE IF NOT EXISTS public.document_counters (
  doc_type    text    NOT NULL,
  period_year integer NOT NULL,
  last_value  bigint  NOT NULL DEFAULT 0,
  CONSTRAINT document_counters_pkey PRIMARY KEY (doc_type, period_year)
);

ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_counters FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_counters TO service_role;

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

  RETURN format('%s-%s-%s', p_doc_type, v_year, lpad(v_value::text, 5, '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO service_role;

-- 3. RFQs ------------------------------------------------------------------------------
-- Matches the live table (user_id is optional: admins can log an RFQ for a
-- walk-in client).
CREATE TABLE IF NOT EXISTS public.rfqs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number       text        NOT NULL UNIQUE,
  user_id          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name     text,
  contact_person   text,
  email            text,
  mobile           text,
  item_name        text        NOT NULL,
  quantity         text        NOT NULL,
  required_by_date date,
  specifications   text,
  drawing_url      text,
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'reviewing', 'quoted', 'accepted', 'declined')),
  quoted_amount    numeric(14, 2),
  admin_notes      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfqs_user_id_idx    ON public.rfqs (user_id);
CREATE INDEX IF NOT EXISTS rfqs_created_at_idx ON public.rfqs (created_at DESC);

-- Same access as 20261015_01 section 5 (repeated so a fresh database, where the
-- table is first created here, ends up identical).
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rfqs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.rfqs', v_policy.policyname);
  END LOOP;
END $$;

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own rfqs"
  ON public.rfqs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all rfqs"
  ON public.rfqs FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. One open automatic purchase order per SKU ---------------------------------------
-- Two orders landing at the same moment could each see "no open PO" and both
-- create one. The unique index makes the second insert fail, which the app
-- treats as "already ordered". Only automatic POs (is_auto) are limited: an
-- admin may still place a manual PO while an automatic one is open. Existing
-- rows default to false, so the index can always be built.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.purchase_orders.is_auto IS 'Raised automatically by the low-stock reorder check.';

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_one_open_auto_per_variant
  ON public.purchase_orders (variant_id)
  WHERE is_auto AND status IN ('Placed', 'Dispatched / In Transit');

-- 5. Stock never below zero -------------------------------------------------------------
-- NOT VALID enforces the rule for every new write immediately; VALIDATE then
-- checks existing rows and is skipped with a warning if any are negative.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_stock_non_negative'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_non_negative
      CHECK (stock_quantity >= 0) NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE public.product_variants
      VALIDATE CONSTRAINT product_variants_stock_non_negative;
  EXCEPTION
    WHEN check_violation THEN
      RAISE WARNING 'Some SKUs have negative stock; the non-negative rule applies to new '
                    'changes only until they are corrected.';
  END;
END $$;

COMMIT;
