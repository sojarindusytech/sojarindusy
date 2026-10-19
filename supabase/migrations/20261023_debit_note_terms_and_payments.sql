-- =============================================================================
-- 20261023_debit_note_terms_and_payments.sql
-- Debit notes get their own terms & conditions, and can be paid like invoices.
-- =============================================================================
-- Requires 20261018_payments, 20261019_02_debit_notes and 20261020_document_terms.
-- Safe to run more than once.
--
--   sales_settings.debit_note_terms   printed on debit notes; blank = the invoice terms
--   payment_allocations               a receipt can now be applied to a debit note
--                                     (kind 'debit_note', debit_note_id)
--   debit_note_payment_summary        per debit note: paid, balance, status (like invoices)
--   record_payment(...)               as in 20261018, plus debit note lines; an automatic
--                                     receipt number also skips one already typed by hand
--   cancel_debit_note(...)            refuses a debit note that has money received against
--                                     it (cancel the receipt first), like an invoice
-- =============================================================================

BEGIN;

-- 1. Terms & conditions for debit notes ---------------------------------------------------
ALTER TABLE public.sales_settings ADD COLUMN IF NOT EXISTS debit_note_terms text;
COMMENT ON COLUMN public.sales_settings.debit_note_terms IS
  'Terms & conditions printed on debit notes. NULL = use terms (the invoice terms).';

-- 2. A receipt can be applied to a debit note -------------------------------------------------
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS debit_note_id uuid REFERENCES public.debit_notes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS debit_note_number text;   -- snapshot, like invoice_number

ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_kind_check;
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_kind_check CHECK (kind IN ('invoice', 'debit_note', 'advance', 'other'));
ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_debit_note_ref;
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_debit_note_ref CHECK ((kind = 'debit_note') = (debit_note_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_payment_allocations_debit_note ON public.payment_allocations(debit_note_id);

-- 3. Per debit note: paid / balance / status -------------------------------------------------------
-- security_invoker: customers only see the rows of debit notes their own RLS lets them see.
CREATE OR REPLACE VIEW public.debit_note_payment_summary
WITH (security_invoker = true) AS
SELECT d.id AS debit_note_id,
       d.total_amount AS total,
       coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) AS paid,
       d.total_amount - coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) AS balance,
       CASE
         WHEN d.status = 'cancelled' THEN 'cancelled'
         WHEN coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) <= 0 THEN 'unpaid'
         WHEN coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) >= d.total_amount THEN 'paid'
         ELSE 'partial'
       END AS payment_status
  FROM public.debit_notes d
  LEFT JOIN public.payment_allocations a ON a.debit_note_id = d.id
  LEFT JOIN public.payments p ON p.id = a.payment_id
 GROUP BY d.id, d.total_amount, d.status;
GRANT SELECT ON public.debit_note_payment_summary TO authenticated, service_role;

-- 4. record_payment: 20261018 plus debit note lines -------------------------------------------------
-- Input (built by the server):
-- { "request_id": uuid, "user_id": uuid | null, "payer_name": text | null, "payment_date": "YYYY-MM-DD",
--   "amount": numeric, "mode": text, "reference": text | null, "deposit_account": text | null,
--   "channel": "ecom" | "offline", "remarks": text | null, "manual_number": text | null,
--   "allocations": [ {"kind": "invoice", "invoice_id": uuid, "amount": n}
--                  | {"kind": "debit_note", "debit_note_id": uuid, "amount": n}
--                  | {"kind": "advance", "amount": n} | {"kind": "other", "amount": n, "note": text} ] }
-- Returns the receipt row as jsonb.
-- Errors (SQLSTATE P0001, code in the message): INVALID_REQUEST, ADMIN_REQUIRED, CUSTOMER_NOT_FOUND,
--   PAYER_REQUIRED, PAYMENT_DATE_INVALID, ALLOCATION_MISMATCH, INVOICE_NOT_FOUND, INVOICE_NOT_PAYABLE,
--   DEBIT_NOTE_NOT_FOUND, DEBIT_NOTE_NOT_PAYABLE, OVER_ALLOCATED, DUPLICATE_RECEIPT_NUMBER, REQUEST_ID_USED.
-- Invoices, then debit notes, are locked in id order, so two admins paying the same document cannot
-- over-pay it, and a retried submit (same request_id) returns the receipt it already created.
CREATE OR REPLACE FUNCTION public.record_payment(p_input jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_uuid_re CONSTANT text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_req       uuid;
  v_user      uuid;
  v_date      date;
  v_amount    numeric(14, 2);
  v_mode      text := p_input ->> 'mode';
  v_channel   text := p_input ->> 'channel';
  v_manual    text := nullif(btrim(coalesce(p_input ->> 'manual_number', '')), '');
  v_payer     text;
  v_today     date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_existing  public.payments;
  v_alloc     jsonb;
  v_kind      text;
  v_a         numeric(14, 2);
  v_sum       numeric(14, 2) := 0;
  v_inv       public.invoices;
  v_dn        public.debit_notes;
  v_paid      numeric;
  v_inv_ids   uuid[] := '{}';
  v_inv_id    uuid;
  v_dn_ids    uuid[] := '{}';
  v_dn_id     uuid;
  v_number    text;
  v_fy        text;
  v_seq       integer;
  v_parts     text[];
  v_tries     integer := 0;
  v_pay       public.payments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Shape ------------------------------------------------------------------------------------
  BEGIN
    v_req    := (p_input ->> 'request_id')::uuid;
    v_user   := nullif(p_input ->> 'user_id', '')::uuid;
    v_date   := (p_input ->> 'payment_date')::date;
    v_amount := (p_input ->> 'amount')::numeric(14, 2);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END;
  IF v_req IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_date IS NULL
     OR v_mode IS NULL OR v_channel IS NULL
     OR v_mode NOT IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'net_banking',
                       'demand_draft', 'wallet', 'payment_gateway', 'other')
     OR v_channel NOT IN ('ecom', 'offline')
     OR jsonb_typeof(p_input -> 'allocations') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_input -> 'allocations') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF v_date > v_today OR v_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'PAYMENT_DATE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Retry of the same submission returns the same receipt -------------------------------------------
  SELECT * INTO v_existing FROM public.payments WHERE request_id = v_req;
  IF FOUND THEN
    IF v_existing.created_by IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'REQUEST_ID_USED' USING ERRCODE = 'P0001';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  -- 3. Payer ----------------------------------------------------------------------------------------------
  IF v_user IS NOT NULL THEN
    SELECT company_name INTO v_payer FROM public.profiles WHERE id = v_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_payer := nullif(btrim(coalesce(p_input ->> 'payer_name', '')), '');
    IF v_payer IS NULL THEN
      RAISE EXCEPTION 'PAYER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  v_payer := coalesce(nullif(btrim(coalesce(p_input ->> 'payer_name', '')), ''), v_payer);

  -- 4. Allocations: shape, sum, and lock every invoice and debit note in id order ---------------------------
  FOR v_alloc IN SELECT value FROM jsonb_array_elements(p_input -> 'allocations') LOOP
    v_kind := v_alloc ->> 'kind';
    BEGIN
      v_a := (v_alloc ->> 'amount')::numeric(14, 2);
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END;
    IF v_kind NOT IN ('invoice', 'debit_note', 'advance', 'other') OR v_a IS NULL OR v_a <= 0 THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF v_kind = 'invoice' THEN
      IF coalesce(v_alloc ->> 'invoice_id', '') !~* c_uuid_re THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
      END IF;
      v_inv_id := (v_alloc ->> 'invoice_id')::uuid;
      IF v_inv_id = ANY (v_inv_ids) THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';   -- one line per invoice
      END IF;
      v_inv_ids := array_append(v_inv_ids, v_inv_id);
    ELSIF v_kind = 'debit_note' THEN
      IF coalesce(v_alloc ->> 'debit_note_id', '') !~* c_uuid_re THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
      END IF;
      v_dn_id := (v_alloc ->> 'debit_note_id')::uuid;
      IF v_dn_id = ANY (v_dn_ids) THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';   -- one line per debit note
      END IF;
      v_dn_ids := array_append(v_dn_ids, v_dn_id);
    END IF;
    v_sum := v_sum + v_a;
  END LOOP;

  IF v_sum <> v_amount THEN
    RAISE EXCEPTION 'ALLOCATION_MISMATCH' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('amount', v_amount, 'allocated', v_sum)::text;
  END IF;

  PERFORM 1 FROM public.invoices WHERE id = ANY (v_inv_ids) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.debit_notes WHERE id = ANY (v_dn_ids) ORDER BY id FOR UPDATE;

  -- 5. Each invoice: exists, issued, this customer's, and the money fits the balance ---------------------------------
  FOR v_alloc IN SELECT value FROM jsonb_array_elements(p_input -> 'allocations') WHERE value ->> 'kind' = 'invoice' LOOP
    SELECT * INTO v_inv FROM public.invoices WHERE id = (v_alloc ->> 'invoice_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.status <> 'issued'
       OR (v_inv.user_id IS NOT NULL AND v_inv.user_id IS DISTINCT FROM v_user) THEN
      RAISE EXCEPTION 'INVOICE_NOT_PAYABLE' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('invoice_number', v_inv.invoice_number)::text;
    END IF;

    SELECT coalesce(sum(a.amount), 0) INTO v_paid
      FROM public.payment_allocations a
      JOIN public.payments p ON p.id = a.payment_id
     WHERE a.invoice_id = v_inv.id AND p.status = 'received';

    IF (v_alloc ->> 'amount')::numeric(14, 2) > v_inv.total_amount - v_paid THEN
      RAISE EXCEPTION 'OVER_ALLOCATED' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('invoice_number', v_inv.invoice_number,
                   'balance', v_inv.total_amount - v_paid,
                   'applied', (v_alloc ->> 'amount')::numeric(14, 2))::text;
    END IF;
  END LOOP;

  -- 5b. Each debit note: the same rules -------------------------------------------------------------------------------
  FOR v_alloc IN SELECT value FROM jsonb_array_elements(p_input -> 'allocations') WHERE value ->> 'kind' = 'debit_note' LOOP
    SELECT * INTO v_dn FROM public.debit_notes WHERE id = (v_alloc ->> 'debit_note_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DEBIT_NOTE_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_dn.status <> 'issued'
       OR (v_dn.user_id IS NOT NULL AND v_dn.user_id IS DISTINCT FROM v_user) THEN
      RAISE EXCEPTION 'DEBIT_NOTE_NOT_PAYABLE' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('debit_note_number', v_dn.debit_note_number)::text;
    END IF;

    SELECT coalesce(sum(a.amount), 0) INTO v_paid
      FROM public.payment_allocations a
      JOIN public.payments p ON p.id = a.payment_id
     WHERE a.debit_note_id = v_dn.id AND p.status = 'received';

    IF (v_alloc ->> 'amount')::numeric(14, 2) > v_dn.total_amount - v_paid THEN
      RAISE EXCEPTION 'OVER_ALLOCATED' USING ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('debit_note_number', v_dn.debit_note_number,
                   'balance', v_dn.total_amount - v_paid,
                   'applied', (v_alloc ->> 'amount')::numeric(14, 2))::text;
    END IF;
  END LOOP;

  -- 6. Receipt number: typed (never moves the counter) or the next free one in the series ----------------------------------
  IF v_manual IS NOT NULL THEN
    IF v_manual !~ '^[A-Za-z0-9/_.-]{1,50}$' THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE receipt_number = v_manual) THEN
      RAISE EXCEPTION 'DUPLICATE_RECEIPT_NUMBER' USING ERRCODE = 'P0001';
    END IF;
    v_number := v_manual;
  ELSE
    -- Skip a number already typed by hand on another receipt, so it can't block the series.
    LOOP
      v_number := public.next_receipt_number();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.payments WHERE receipt_number = v_number);
      v_tries := v_tries + 1;
      IF v_tries >= 1000 THEN
        RAISE EXCEPTION 'DUPLICATE_RECEIPT_NUMBER' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
    v_parts := string_to_array(v_number, '/');
    v_seq := nullif(v_parts[array_length(v_parts, 1)], '')::integer;
    v_fy  := v_parts[array_length(v_parts, 1) - 1];
  END IF;

  -- 7. Store ------------------------------------------------------------------------------------------------------------------
  INSERT INTO public.payments (
    request_id, receipt_number, receipt_fy, seq, numbering_mode, payment_date, amount, mode, reference,
    deposit_account, channel, source, user_id, payer_name, remarks, created_by
  ) VALUES (
    v_req, v_number, v_fy, v_seq, CASE WHEN v_manual IS NULL THEN 'auto' ELSE 'manual' END,
    v_date, v_amount, v_mode, nullif(btrim(coalesce(p_input ->> 'reference', '')), ''),
    nullif(btrim(coalesce(p_input ->> 'deposit_account', '')), ''), v_channel,
    CASE WHEN v_mode = 'payment_gateway' THEN 'gateway' ELSE 'manual' END,
    v_user, v_payer, nullif(btrim(coalesce(p_input ->> 'remarks', '')), ''), p_actor
  ) RETURNING * INTO v_pay;

  INSERT INTO public.payment_allocations (
    payment_id, kind, invoice_id, invoice_number, debit_note_id, debit_note_number, amount, note
  )
  SELECT v_pay.id, a.value ->> 'kind',
         CASE WHEN a.value ->> 'kind' = 'invoice' THEN (a.value ->> 'invoice_id')::uuid END,
         CASE WHEN a.value ->> 'kind' = 'invoice'
              THEN (SELECT i.invoice_number FROM public.invoices i WHERE i.id = (a.value ->> 'invoice_id')::uuid) END,
         CASE WHEN a.value ->> 'kind' = 'debit_note' THEN (a.value ->> 'debit_note_id')::uuid END,
         CASE WHEN a.value ->> 'kind' = 'debit_note'
              THEN (SELECT d.debit_note_number FROM public.debit_notes d WHERE d.id = (a.value ->> 'debit_note_id')::uuid) END,
         (a.value ->> 'amount')::numeric(14, 2),
         nullif(btrim(coalesce(a.value ->> 'note', '')), '')
    FROM jsonb_array_elements(p_input -> 'allocations') a;

  RETURN to_jsonb(v_pay);
END;
$$;

-- 5. cancel_debit_note: as in 20261019_02, but never while money is applied to it ---------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_debit_note(p_debit_note_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_dn   public.debit_notes;
  v_paid numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Locked like record_payment locks it, so a payment and a cancel can't cross.
  SELECT * INTO v_dn FROM public.debit_notes WHERE id = p_debit_note_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEBIT_NOTE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_dn.status = 'cancelled' THEN
    RETURN jsonb_build_object('already_cancelled', true, 'debit_note_number', v_dn.debit_note_number);
  END IF;

  SELECT coalesce(sum(a.amount), 0) INTO v_paid
    FROM public.payment_allocations a
    JOIN public.payments p ON p.id = a.payment_id
   WHERE a.debit_note_id = v_dn.id AND p.status = 'received';
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'DEBIT_NOTE_HAS_PAYMENTS' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('paid', v_paid, 'debit_note_number', v_dn.debit_note_number)::text;
  END IF;

  UPDATE public.debit_notes
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason), updated_at = now()
   WHERE id = p_debit_note_id;

  RETURN jsonb_build_object('already_cancelled', false, 'debit_note_number', v_dn.debit_note_number,
                            'user_id', v_dn.user_id, 'total_amount', v_dn.total_amount);
END;
$$;

-- 6. Privileges: server-only (CREATE OR REPLACE keeps them; restated for a fresh database) -----------------------------------
REVOKE ALL ON FUNCTION public.record_payment(jsonb, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_debit_note(uuid, text, uuid)   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(jsonb, uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_debit_note(uuid, text, uuid) TO service_role;

COMMIT;
