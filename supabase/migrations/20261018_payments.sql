-- =============================================================================
-- 20261018_payments.sql
-- Payments Received: receipts numbered per financial year, split across invoices.
-- =============================================================================
-- Requires 20261010 (invoices + sales_settings) and 20261015_01..05.
--
--   payments               one row per receipt (money received), immutable except cancel
--   payment_allocations    where the money went: invoice(s), advance, other. Sum = payment amount
--   invoice_payment_summary  per invoice: paid, balance, status (unpaid / partial / paid / cancelled)
--   next_receipt_number()  FY counter, same scheme as invoices / quotes (SI/RCPT/25-26/01)
--   record_payment(...)    validates, locks the invoices, numbers and stores a receipt atomically
--   cancel_payment(...)    voids a receipt once; its allocations stop counting
--
-- Cancel, never delete: a receipt number is never reused and a recorded receipt can only be
-- cancelled (with a reason), not edited, so the books stay explainable.
-- =============================================================================

BEGIN;

-- 1. Numbering settings ---------------------------------------------------------
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS receipt_prefix text NOT NULL DEFAULT 'SI/RCPT',
  ADD COLUMN IF NOT EXISTS receipt_fy text,
  ADD COLUMN IF NOT EXISTS receipt_next_number integer NOT NULL DEFAULT 1 CHECK (receipt_next_number >= 1),
  ADD COLUMN IF NOT EXISTS receipt_pad integer NOT NULL DEFAULT 2 CHECK (receipt_pad BETWEEN 1 AND 8);

-- Atomic: one UPDATE row-locks sales_settings, so concurrent callers always get distinct numbers.
-- Financial year runs April to March (IST); on rollover the counter restarts at 1.
CREATE OR REPLACE FUNCTION public.next_receipt_number()
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
  SET receipt_next_number = CASE WHEN receipt_fy IS DISTINCT FROM cur_fy THEN 2 ELSE receipt_next_number + 1 END,
      receipt_fy = cur_fy,
      updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_settings row is missing';
  END IF;

  -- RETURNING gives the already-incremented counter; the issued number is one less.
  RETURN s.receipt_prefix || '/' || s.receipt_fy || '/' || lpad((s.receipt_next_number - 1)::text, s.receipt_pad, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO service_role;

-- 2. Tables ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  receipt_number text NOT NULL UNIQUE CHECK (receipt_number ~ '^[A-Za-z0-9/_.-]{1,50}$'),
  receipt_fy text,
  seq integer,                                     -- NULL when the number was typed manually
  numbering_mode text NOT NULL CHECK (numbering_mode IN ('auto', 'manual')),
  payment_date date NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  mode text NOT NULL CHECK (mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'net_banking',
                                     'demand_draft', 'wallet', 'payment_gateway', 'other')),
  reference text,                                  -- UTR / cheque no. / transaction id
  deposit_account text,                            -- bank account or cash book it landed in
  channel text NOT NULL CHECK (channel IN ('ecom', 'offline')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'gateway')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,   -- NULL for a walk-in / POS payer
  payer_name text NOT NULL CHECK (length(btrim(payer_name)) > 0),
  remarks text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'cancelled')),
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_cancel_consistent CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('invoice', 'advance', 'other')),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
  invoice_number text,                             -- snapshot
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  note text,
  CONSTRAINT payment_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT payment_allocations_invoice_ref CHECK ((kind = 'invoice') = (invoice_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON public.payment_allocations(invoice_id);

-- 3. Immutability: a receipt can only be cancelled ---------------------------------------
CREATE OR REPLACE FUNCTION public.protect_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  -- Only received -> cancelled, and only the cancel fields change.
  IF OLD.status = 'received' AND NEW.status = 'cancelled'
     AND (to_jsonb(NEW) - 'status' - 'cancelled_at' - 'cancel_reason')
       = (to_jsonb(OLD) - 'status' - 'cancelled_at' - 'cancel_reason') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_payment ON public.payments;
CREATE TRIGGER protect_payment BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_payment();

CREATE OR REPLACE FUNCTION public.protect_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_payment_allocation ON public.payment_allocations;
CREATE TRIGGER protect_payment_allocation BEFORE UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.protect_payment_allocation();

-- 4. Row level security: server writes, customers read their own -----------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on payments" ON public.payments;
DROP POLICY IF EXISTS "Customers read own payments" ON public.payments;
DROP POLICY IF EXISTS "Service role full access on payment_allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Customers read own payment allocations" ON public.payment_allocations;

CREATE POLICY "Service role full access on payments"
  ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Customers read own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'received');

CREATE POLICY "Service role full access on payment_allocations"
  ON public.payment_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Customers read own payment allocations"
  ON public.payment_allocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p
                  WHERE p.id = payment_allocations.payment_id
                    AND p.user_id = auth.uid() AND p.status = 'received'));

REVOKE ALL ON public.payments, public.payment_allocations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payments, public.payment_allocations FROM authenticated;

-- 5. Per-invoice paid / balance / status --------------------------------------------------------
-- security_invoker: customers only see the rows of invoices their own RLS lets them see.
CREATE OR REPLACE VIEW public.invoice_payment_summary
WITH (security_invoker = true) AS
SELECT i.id AS invoice_id,
       i.total_amount AS total,
       coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) AS paid,
       i.total_amount - coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) AS balance,
       CASE
         WHEN i.status = 'cancelled' THEN 'cancelled'
         WHEN coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) <= 0 THEN 'unpaid'
         WHEN coalesce(sum(a.amount) FILTER (WHERE p.status = 'received'), 0) >= i.total_amount THEN 'paid'
         ELSE 'partial'
       END AS payment_status
  FROM public.invoices i
  LEFT JOIN public.payment_allocations a ON a.invoice_id = i.id
  LEFT JOIN public.payments p ON p.id = a.payment_id
 GROUP BY i.id, i.total_amount, i.status;
GRANT SELECT ON public.invoice_payment_summary TO authenticated, service_role;

-- An invoice that has received money cannot be cancelled or reduced below what was paid:
-- cancel the receipt first (or issue a credit note).
CREATE OR REPLACE FUNCTION public.guard_invoice_with_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_paid numeric;
BEGIN
  SELECT coalesce(sum(a.amount), 0) INTO v_paid
    FROM public.payment_allocations a
    JOIN public.payments p ON p.id = a.payment_id
   WHERE a.invoice_id = OLD.id AND p.status = 'received';

  IF v_paid > 0 AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    RAISE EXCEPTION 'INVOICE_HAS_PAYMENTS' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('paid', v_paid)::text;
  END IF;
  IF v_paid > 0 AND NEW.total_amount < v_paid THEN
    RAISE EXCEPTION 'TOTAL_BELOW_PAID' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('paid', v_paid, 'total', NEW.total_amount)::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_invoice_with_payments ON public.invoices;
CREATE TRIGGER guard_invoice_with_payments BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_with_payments();

-- 6. record_payment ---------------------------------------------------------------------------------
-- Input (built by the server):
-- { "request_id": uuid, "user_id": uuid | null, "payer_name": text | null, "payment_date": "YYYY-MM-DD",
--   "amount": numeric, "mode": text, "reference": text | null, "deposit_account": text | null,
--   "channel": "ecom" | "offline", "remarks": text | null, "manual_number": text | null,
--   "allocations": [ {"kind": "invoice", "invoice_id": uuid, "amount": n}
--                  | {"kind": "advance", "amount": n} | {"kind": "other", "amount": n, "note": text} ] }
-- Returns the receipt row as jsonb.
-- Errors (SQLSTATE P0001, code in the message): INVALID_REQUEST, ADMIN_REQUIRED, CUSTOMER_NOT_FOUND,
--   PAYER_REQUIRED, PAYMENT_DATE_INVALID, ALLOCATION_MISMATCH, INVOICE_NOT_FOUND, INVOICE_NOT_PAYABLE,
--   OVER_ALLOCATED, DUPLICATE_RECEIPT_NUMBER, REQUEST_ID_USED.
-- The invoices are locked in id order, so two admins paying the same invoice cannot over-pay it, and a
-- retried submit (same request_id) returns the receipt it already created.
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
  v_paid      numeric;
  v_inv_ids   uuid[] := '{}';
  v_inv_id    uuid;
  v_number    text;
  v_fy        text;
  v_seq       integer;
  v_parts     text[];
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

  -- 4. Allocations: shape, sum, and lock every invoice in id order --------------------------------------------
  FOR v_alloc IN SELECT value FROM jsonb_array_elements(p_input -> 'allocations') LOOP
    v_kind := v_alloc ->> 'kind';
    BEGIN
      v_a := (v_alloc ->> 'amount')::numeric(14, 2);
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END;
    IF v_kind NOT IN ('invoice', 'advance', 'other') OR v_a IS NULL OR v_a <= 0 THEN
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
    END IF;
    v_sum := v_sum + v_a;
  END LOOP;

  IF v_sum <> v_amount THEN
    RAISE EXCEPTION 'ALLOCATION_MISMATCH' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('amount', v_amount, 'allocated', v_sum)::text;
  END IF;

  PERFORM 1 FROM public.invoices WHERE id = ANY (v_inv_ids) ORDER BY id FOR UPDATE;

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

  -- 6. Receipt number: typed (never moves the counter) or the next one in the series ----------------------------------------
  IF v_manual IS NOT NULL THEN
    IF v_manual !~ '^[A-Za-z0-9/_.-]{1,50}$' THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE receipt_number = v_manual) THEN
      RAISE EXCEPTION 'DUPLICATE_RECEIPT_NUMBER' USING ERRCODE = 'P0001';
    END IF;
    v_number := v_manual;
  ELSE
    v_number := public.next_receipt_number();
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

  INSERT INTO public.payment_allocations (payment_id, kind, invoice_id, invoice_number, amount, note)
  SELECT v_pay.id, a.value ->> 'kind',
         CASE WHEN a.value ->> 'kind' = 'invoice' THEN (a.value ->> 'invoice_id')::uuid END,
         CASE WHEN a.value ->> 'kind' = 'invoice'
              THEN (SELECT i.invoice_number FROM public.invoices i WHERE i.id = (a.value ->> 'invoice_id')::uuid) END,
         (a.value ->> 'amount')::numeric(14, 2),
         nullif(btrim(coalesce(a.value ->> 'note', '')), '')
    FROM jsonb_array_elements(p_input -> 'allocations') a;

  RETURN to_jsonb(v_pay);
END;
$$;

-- 7. cancel_payment: void a receipt once; its allocations stop counting ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_pay public.payments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status = 'cancelled' THEN
    RETURN jsonb_build_object('already_cancelled', true, 'receipt_number', v_pay.receipt_number);
  END IF;

  UPDATE public.payments
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason)
   WHERE id = p_payment_id;

  RETURN jsonb_build_object('already_cancelled', false, 'receipt_number', v_pay.receipt_number,
                            'amount', v_pay.amount);
END;
$$;

-- 8. Privileges: server-only -----------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_payment(jsonb, uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_payment(uuid, text, uuid)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(jsonb, uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_payment(uuid, text, uuid)    TO service_role;

COMMIT;
