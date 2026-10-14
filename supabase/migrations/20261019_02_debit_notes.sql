-- =============================================================================
-- 20261019_02_debit_notes.sql
-- GST debit notes: issued to a customer against one of our tax invoices.
-- =============================================================================
-- Requires 20261010 (invoices, sales_settings), 20261018 (payments) and
-- 20261019_01 (next_series_number). Safe to run more than once.
--
-- A debit note (CGST Act s.34(3)) is issued when an invoice charged LESS than
-- was due: a price revised upward, quantity short-billed, extra charges
-- (freight, packing) or GST charged at too low a rate. It raises what the
-- customer owes and is reported in GSTR-1 for the month it is issued.
-- Rule 53(1A): number of at most 16 characters (letters, digits, "-" and "/"),
-- unique in the financial year, and it must quote the original invoice's
-- number and date.
--
--   debit_notes                 one row per debit note; immutable except cancel
--   next_series_number('debit_note')  FY counter, same scheme as invoices (SI/DN/25-26/01)
--   issue_debit_note(...)       validates, numbers and stores a debit note atomically
--   cancel_debit_note(...)      voids it once, with a reason
--   guard on invoices           an invoice with live debit notes can't be edited or cancelled
--
-- Cancel, never delete: a number is never reused, so the books stay explainable.
-- =============================================================================

BEGIN;

-- 1. Numbering settings ------------------------------------------------------------
-- Default "SI/DN/25-26/01" is 14 characters, within the 16-character GST limit.
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS debit_note_prefix text NOT NULL DEFAULT 'SI/DN',
  ADD COLUMN IF NOT EXISTS debit_note_fy text,
  ADD COLUMN IF NOT EXISTS debit_note_next_number integer NOT NULL DEFAULT 1 CHECK (debit_note_next_number >= 1),
  ADD COLUMN IF NOT EXISTS debit_note_pad integer NOT NULL DEFAULT 2 CHECK (debit_note_pad BETWEEN 1 AND 8);

-- 2. Table ---------------------------------------------------------------------------
-- bill_to / place_of_supply / gst_enabled / invoice_number / invoice_date are copied
-- from the invoice when the note is issued: the note always prints what it was issued
-- against. items / totals have the same shape as an invoice's.
CREATE TABLE IF NOT EXISTS public.debit_notes (
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),
  request_id        uuid          NOT NULL UNIQUE,
  debit_note_number text          NOT NULL UNIQUE CHECK (debit_note_number ~ '^[A-Za-z0-9/-]{1,16}$'),
  debit_note_fy     text,
  seq               integer,                       -- NULL when the number was typed manually
  numbering_mode    text          NOT NULL CHECK (numbering_mode IN ('auto', 'manual')),
  debit_note_date   date          NOT NULL,
  invoice_id        uuid          NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  invoice_number    text          NOT NULL,
  invoice_date      date          NOT NULL,
  user_id           uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason            text          NOT NULL CHECK (reason IN ('price_increase', 'quantity_short_billed',
                                                           'additional_charges', 'tax_rate_correction', 'other')),
  reason_note       text,
  bill_to           jsonb         NOT NULL,
  place_of_supply   text,
  gst_enabled       boolean       NOT NULL,
  items             jsonb         NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  totals            jsonb         NOT NULL,
  total_amount      numeric(14, 2) NOT NULL CHECK (total_amount > 0),
  amount_in_words   text,
  status            text          NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_by        uuid          REFERENCES auth.users(id),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT debit_notes_pkey PRIMARY KEY (id),
  CONSTRAINT debit_notes_cancel_consistent CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT debit_notes_other_needs_note CHECK (reason <> 'other' OR length(btrim(coalesce(reason_note, ''))) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_invoice ON public.debit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_user ON public.debit_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_date ON public.debit_notes(debit_note_date DESC);

COMMENT ON TABLE public.debit_notes IS
  'GST debit notes (CGST Act s.34(3)) issued against our tax invoices. Immutable once issued; cancel with a reason.';

-- 3. Immutability: a debit note can only be cancelled ------------------------------------
CREATE OR REPLACE FUNCTION public.protect_debit_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DEBIT_NOTE_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  -- Only issued -> cancelled, and only the cancel fields change.
  IF OLD.status = 'issued' AND NEW.status = 'cancelled'
     AND (to_jsonb(NEW) - ARRAY['status', 'cancelled_at', 'cancel_reason', 'updated_at'])
       = (to_jsonb(OLD) - ARRAY['status', 'cancelled_at', 'cancel_reason', 'updated_at']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'DEBIT_NOTE_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_debit_note ON public.debit_notes;
CREATE TRIGGER protect_debit_note BEFORE UPDATE OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.protect_debit_note();

-- 4. An invoice with live debit notes is frozen --------------------------------------------
-- The notes quote its number, date, GST basis and amounts; changing or cancelling the
-- invoice underneath them would make them wrong. Cancel the debit notes first.
-- Stock bookkeeping columns (20261017) are still free to change.
CREATE OR REPLACE FUNCTION public.guard_invoice_with_debit_notes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_numbers text;
BEGIN
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'stock_owner', 'stock_posted_at', 'stock_reversed_at'])
     IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'stock_owner', 'stock_posted_at', 'stock_reversed_at']) THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(d.debit_note_number, ', ' ORDER BY d.debit_note_number) INTO v_numbers
    FROM public.debit_notes d
   WHERE d.invoice_id = OLD.id AND d.status = 'issued';

  IF v_numbers IS NOT NULL THEN
    RAISE EXCEPTION 'INVOICE_HAS_DEBIT_NOTES' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('debit_notes', v_numbers)::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_invoice_with_debit_notes ON public.invoices;
CREATE TRIGGER guard_invoice_with_debit_notes BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_with_debit_notes();

-- 5. Row level security: the server writes; customers read their own -------------------------
-- A customer sees an issued note only while they can see its invoice (the invoices
-- policy applies inside the EXISTS), e.g. not before the order is delivered.
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on debit_notes" ON public.debit_notes;
DROP POLICY IF EXISTS "Customers read own debit notes" ON public.debit_notes;

CREATE POLICY "Service role full access on debit_notes"
  ON public.debit_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Customers read own debit notes"
  ON public.debit_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         AND status = 'issued'
         AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = debit_notes.invoice_id));

REVOKE ALL ON public.debit_notes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.debit_notes FROM authenticated;
GRANT SELECT ON public.debit_notes TO authenticated;
GRANT ALL ON public.debit_notes TO service_role;

-- 6. issue_debit_note --------------------------------------------------------------------------------
-- Input (built by the server; amounts come from the same invoice maths as invoices):
-- { "request_id": uuid, "invoice_id": uuid, "debit_note_date": "YYYY-MM-DD",
--   "reason": text, "reason_note": text | null, "manual_number": text | null,
--   "items": [InvoiceLine...], "totals": InvoiceTotals, "total_amount": numeric,
--   "amount_in_words": text }
-- Returns the debit note row as jsonb.
-- Errors (SQLSTATE P0001, code in the message): ADMIN_REQUIRED, INVALID_REQUEST, REQUEST_ID_USED,
--   INVOICE_NOT_FOUND, INVOICE_NOT_ISSUED, DEBIT_NOTE_DATE_INVALID, REASON_NOTE_REQUIRED,
--   TAX_MISMATCH, INVALID_NUMBER, DUPLICATE_DEBIT_NOTE_NUMBER, DEBIT_NOTE_NUMBER_TOO_LONG.
CREATE OR REPLACE FUNCTION public.issue_debit_note(p_input jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_uuid_re  CONSTANT text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  c_num_re   CONSTANT text := '^[0-9]+(\.[0-9]+)?$';
  v_req      uuid;
  v_inv_id   uuid;
  v_date     date;
  v_total    numeric(14, 2);
  v_reason   text := p_input ->> 'reason';
  v_note     text := nullif(btrim(coalesce(p_input ->> 'reason_note', '')), '');
  v_manual   text := nullif(btrim(coalesce(p_input ->> 'manual_number', '')), '');
  v_today    date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_existing public.debit_notes;
  v_inv      public.invoices;
  v_item     jsonb;
  v_inv_igst boolean;
  v_inv_cgst boolean;
  v_dn_igst  boolean := false;
  v_dn_cgst  boolean := false;
  v_number   text;
  v_fy       text;
  v_seq      integer;
  v_parts    text[];
  v_tries    integer := 0;
  v_dn       public.debit_notes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Shape --------------------------------------------------------------------------------------
  IF coalesce(p_input ->> 'request_id', '') !~* c_uuid_re
     OR coalesce(p_input ->> 'invoice_id', '') !~* c_uuid_re
     OR coalesce(p_input ->> 'total_amount', '') !~ c_num_re
     OR jsonb_typeof(p_input -> 'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_input -> 'items') NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_input -> 'totals') IS DISTINCT FROM 'object'
     OR v_reason IS NULL
     OR v_reason NOT IN ('price_increase', 'quantity_short_billed', 'additional_charges', 'tax_rate_correction', 'other') THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_req    := (p_input ->> 'request_id')::uuid;
    v_inv_id := (p_input ->> 'invoice_id')::uuid;
    v_date   := (p_input ->> 'debit_note_date')::date;
    v_total  := (p_input ->> 'total_amount')::numeric(14, 2);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END;
  IF v_date IS NULL OR v_total <= 0 OR coalesce(p_input #>> '{totals,total}', '') !~ c_num_re THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF (p_input #>> '{totals,total}')::numeric <> v_total THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF v_reason = 'other' AND length(coalesce(v_note, '')) < 3 THEN
    RAISE EXCEPTION 'REASON_NOTE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- 2. A retried submit returns the note it already created ------------------------------------------
  SELECT * INTO v_existing FROM public.debit_notes WHERE request_id = v_req;
  IF FOUND THEN
    IF v_existing.created_by IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'REQUEST_ID_USED' USING ERRCODE = 'P0001';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  -- 3. The invoice: issued, and held so it can't be cancelled while this note is written ------------
  SELECT * INTO v_inv FROM public.invoices WHERE id = v_inv_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'INVOICE_NOT_ISSUED' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('invoice_number', v_inv.invoice_number)::text;
  END IF;
  -- Never before the invoice it adjusts, never in the future (a note can't be backdated past it).
  IF v_date < v_inv.invoice_date OR v_date > v_today THEN
    RAISE EXCEPTION 'DEBIT_NOTE_DATE_INVALID' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('invoice_date', v_inv.invoice_date)::text;
  END IF;

  -- 4. Lines: GST follows the invoice (no GST on a non-GST invoice; CGST+SGST or IGST as on it) -----
  SELECT coalesce(bool_or(coalesce((e ->> 'igst')::numeric, 0) > 0), false),
         coalesce(bool_or(coalesce((e ->> 'cgst')::numeric, 0) > 0), false)
    INTO v_inv_igst, v_inv_cgst
    FROM jsonb_array_elements(coalesce(v_inv.items, '[]'::jsonb)) e;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_input -> 'items') LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR coalesce(btrim(v_item ->> 'name'), '') = ''
       OR coalesce(v_item ->> 'quantity', '') !~ c_num_re
       OR coalesce(v_item ->> 'taxable', '') !~ c_num_re
       OR coalesce(v_item ->> 'gstRate', '') !~ c_num_re
       OR coalesce(v_item ->> 'cgst', '') !~ c_num_re
       OR coalesce(v_item ->> 'sgst', '') !~ c_num_re
       OR coalesce(v_item ->> 'igst', '') !~ c_num_re THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF (v_item ->> 'quantity')::numeric <= 0 OR (v_item ->> 'taxable')::numeric <= 0
       OR (v_item ->> 'gstRate')::numeric > 100 THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_inv.gst_enabled
       AND ((v_item ->> 'gstRate')::numeric <> 0
            OR (v_item ->> 'cgst')::numeric + (v_item ->> 'sgst')::numeric + (v_item ->> 'igst')::numeric <> 0) THEN
      RAISE EXCEPTION 'TAX_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
    v_dn_igst := v_dn_igst OR (v_item ->> 'igst')::numeric > 0;
    v_dn_cgst := v_dn_cgst OR (v_item ->> 'cgst')::numeric > 0 OR (v_item ->> 'sgst')::numeric > 0;
  END LOOP;

  IF (v_dn_igst AND v_dn_cgst) OR (v_dn_igst AND v_inv_cgst) OR (v_dn_cgst AND v_inv_igst) THEN
    RAISE EXCEPTION 'TAX_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- 5. Number: typed (never moves the counter) or the next free one in the series -----------------
  IF v_manual IS NOT NULL THEN
    IF v_manual !~ '^[A-Za-z0-9/-]{1,16}$' THEN
      RAISE EXCEPTION 'INVALID_NUMBER' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.debit_notes WHERE debit_note_number = v_manual) THEN
      RAISE EXCEPTION 'DUPLICATE_DEBIT_NOTE_NUMBER' USING ERRCODE = 'P0001';
    END IF;
    v_number := v_manual;
  ELSE
    -- Skip numbers already taken by a typed number, so a manual entry can't block the series.
    LOOP
      v_number := public.next_series_number('debit_note');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.debit_notes WHERE debit_note_number = v_number);
      v_tries := v_tries + 1;
      IF v_tries >= 1000 THEN
        RAISE EXCEPTION 'DUPLICATE_DEBIT_NOTE_NUMBER' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
    -- Rolls back with the counter, so a too-long prefix never burns a number.
    IF length(v_number) > 16 THEN
      RAISE EXCEPTION 'DEBIT_NOTE_NUMBER_TOO_LONG' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('number', v_number)::text;
    END IF;
    v_parts := string_to_array(v_number, '/');
    v_seq := nullif(v_parts[array_length(v_parts, 1)], '')::integer;
    v_fy  := v_parts[array_length(v_parts, 1) - 1];
  END IF;

  -- 6. Store -----------------------------------------------------------------------------------------------
  INSERT INTO public.debit_notes (
    request_id, debit_note_number, debit_note_fy, seq, numbering_mode, debit_note_date,
    invoice_id, invoice_number, invoice_date, user_id, reason, reason_note,
    bill_to, place_of_supply, gst_enabled, items, totals, total_amount, amount_in_words, created_by
  ) VALUES (
    v_req, v_number, v_fy, v_seq, CASE WHEN v_manual IS NULL THEN 'auto' ELSE 'manual' END, v_date,
    v_inv.id, v_inv.invoice_number, v_inv.invoice_date, v_inv.user_id, v_reason, v_note,
    v_inv.bill_to, v_inv.place_of_supply, v_inv.gst_enabled, p_input -> 'items', p_input -> 'totals',
    v_total, nullif(btrim(coalesce(p_input ->> 'amount_in_words', '')), ''), p_actor
  ) RETURNING * INTO v_dn;

  RETURN to_jsonb(v_dn);
END;
$$;

-- 7. cancel_debit_note: void once, with a reason --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_debit_note(p_debit_note_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_dn public.debit_notes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dn FROM public.debit_notes WHERE id = p_debit_note_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEBIT_NOTE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_dn.status = 'cancelled' THEN
    RETURN jsonb_build_object('already_cancelled', true, 'debit_note_number', v_dn.debit_note_number);
  END IF;

  UPDATE public.debit_notes
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason), updated_at = now()
   WHERE id = p_debit_note_id;

  RETURN jsonb_build_object('already_cancelled', false, 'debit_note_number', v_dn.debit_note_number,
                            'user_id', v_dn.user_id, 'total_amount', v_dn.total_amount);
END;
$$;

-- 8. Privileges: server-only -------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.issue_debit_note(jsonb, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_debit_note(uuid, text, uuid)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_debit_note(jsonb, uuid)       TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_debit_note(uuid, text, uuid) TO service_role;

COMMIT;
