-- Credit notes rollout plan:
-- 1. Apply after the invoice, quotation and 20261015 migrations, before the app release.
-- 2. Add independent Sales Settings numbering and immutable invoice-linked snapshots.
-- 3. Issue atomically: lock invoice + settings, validate quantities, compute from invoice,
--    reserve number and persist document. Manual numbering never consumes the counter.
-- 4. Enable admin issue/list/PDF and customer read/PDF. No stock, payment or filing writes.
-- 5. Verify in staging with tests/db/credit-notes.test.ts scenarios; keep migration on rollback
--    once documents exist (roll back application only; never discard issued records).
BEGIN;
ALTER TABLE public.sales_settings
  ADD COLUMN credit_note_prefix text NOT NULL DEFAULT 'SI/CN'
    CHECK (credit_note_prefix ~ '^[A-Za-z0-9/-]{1,7}$'),
  ADD COLUMN credit_note_fy text,
  ADD COLUMN credit_note_next_number integer NOT NULL DEFAULT 1 CHECK (credit_note_next_number BETWEEN 1 AND 99999999),
  ADD COLUMN credit_note_pad integer NOT NULL DEFAULT 2 CHECK (credit_note_pad BETWEEN 1 AND 8);

CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  credit_note_number text NOT NULL UNIQUE CHECK (credit_note_number ~ '^[A-Za-z0-9/-]{1,16}$'),
  credit_note_fy text,
  seq integer,
  numbering_mode text NOT NULL CHECK (numbering_mode IN ('auto', 'manual')),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  credit_note_date date NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  treatment text NOT NULL CHECK (treatment IN ('gst','commercial')),
  bill_to jsonb NOT NULL,
  place_of_supply text,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  totals jsonb NOT NULL,
  total_amount numeric(18,2) NOT NULL CHECK (total_amount > 0),
  seller_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status = 'issued'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_notes_invoice_idx ON public.credit_notes(invoice_id);
CREATE INDEX credit_notes_customer_idx ON public.credit_notes(user_id);
CREATE INDEX credit_notes_date_idx ON public.credit_notes(credit_note_date DESC);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
-- Writes only through the service-only transaction below. No direct API writes.
REVOKE ALL ON public.credit_notes FROM anon, authenticated, service_role;
GRANT SELECT ON public.credit_notes TO authenticated, service_role;
CREATE POLICY credit_notes_customer_read ON public.credit_notes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY credit_notes_service_read ON public.credit_notes FOR SELECT TO service_role USING (true);

CREATE FUNCTION public.protect_credited_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.credit_notes WHERE invoice_id = OLD.id) THEN
    RAISE EXCEPTION 'An invoice with issued credit notes cannot be changed or deleted.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- SECURITY DEFINER is required so an invoice mutation cannot hide notes via RLS.
ALTER FUNCTION public.protect_credited_invoice() SECURITY DEFINER;
CREATE TRIGGER protect_credited_invoice BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_credited_invoice();

CREATE FUNCTION public.protect_credit_note() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Issued credit notes are immutable.'; END $$;
CREATE TRIGGER protect_credit_note BEFORE UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW EXECUTE FUNCTION public.protect_credit_note();

CREATE FUNCTION public.issue_credit_note(p_input jsonb, p_actor uuid)
RETURNS public.credit_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.invoices; settings public.sales_settings; note public.credit_notes;
  entry jsonb; src jsonb; line jsonb; lines jsonb := '[]'; tax_summary jsonb;
  idx integer; seen integer[] := '{}'; qty numeric; used numeric; source_qty numeric;
  taxable numeric; cgst numeric; sgst numeric; igst numeric; discount numeric; amount numeric;
  subtotal numeric := 0; total numeric; prior_subtotal numeric; prior_total numeric;
  round_off numeric; original_subtotal numeric; original_round numeric;
  note_date date := (p_input->>'date')::date;
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  fy text; year_start integer; seq_num integer; number text; manual text := nullif(btrim(p_input->>'manualNumber'), '');
  treatment text := p_input->>'treatment';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin','platform_owner')) THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;
  SELECT * INTO inv FROM public.invoices WHERE id = (p_input->>'invoiceId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found.'; END IF;
  -- Retry lookup under the invoice lock; the same submission never issues twice.
  SELECT * INTO note FROM public.credit_notes WHERE request_id = (p_input->>'requestId')::uuid;
  IF FOUND THEN
    IF note.invoice_id <> inv.id OR note.created_by <> p_actor THEN RAISE EXCEPTION 'Submission key already used.'; END IF;
    RETURN note;
  END IF;
  IF inv.status <> 'issued' THEN RAISE EXCEPTION 'Only issued invoices can be credited.'; END IF;
  IF note_date IS NULL OR note_date < inv.invoice_date OR note_date > today THEN RAISE EXCEPTION 'Credit note date must be between the invoice date and today.'; END IF;
  year_start := extract(year FROM today)::integer - CASE WHEN extract(month FROM today) < 4 THEN 1 ELSE 0 END;
  -- Same issuing-year series as invoices/quotes; avoid silently numbering historical dates in a different FY.
  IF note_date < make_date(year_start, 4, 1) THEN RAISE EXCEPTION 'Issue the credit note in the current financial year.'; END IF;
  fy := to_char(make_date(year_start,4,1),'YY') || '-' || to_char(make_date(year_start+1,4,1),'YY');
  IF treatment IS NULL OR treatment NOT IN ('gst','commercial') OR (treatment = 'gst' AND NOT inv.gst_enabled) THEN RAISE EXCEPTION 'Invalid tax treatment for this invoice.'; END IF;
  IF jsonb_typeof(p_input->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'lines') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select invoice lines.'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_input->'lines') LOOP
    IF coalesce(entry->>'index','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid invoice line.'; END IF;
    idx := (entry->>'index')::integer; qty := (entry->>'quantity')::numeric;
    src := inv.items->idx;
    IF src IS NULL OR idx = ANY(seen) OR qty IS NULL OR qty <= 0 OR qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid invoice line or quantity.'; END IF;
    seen := array_append(seen, idx);
    source_qty := (src->>'quantity')::numeric;
    SELECT coalesce(sum((l->>'quantity')::numeric),0) INTO used
      FROM public.credit_notes c CROSS JOIN LATERAL jsonb_array_elements(c.items) l
      WHERE c.invoice_id = inv.id AND (l->>'sourceIndex')::integer = idx;
    IF source_qty <= 0 OR used + qty > source_qty THEN RAISE EXCEPTION 'Quantity exceeds the remaining creditable quantity.'; END IF;
    taxable := round((src->>'taxable')::numeric * (used+qty)/source_qty,2) - round((src->>'taxable')::numeric * used/source_qty,2);
    cgst := round((src->>'cgst')::numeric * (used+qty)/source_qty,2) - round((src->>'cgst')::numeric * used/source_qty,2);
    sgst := round((src->>'sgst')::numeric * (used+qty)/source_qty,2) - round((src->>'sgst')::numeric * used/source_qty,2);
    igst := round((src->>'igst')::numeric * (used+qty)/source_qty,2) - round((src->>'igst')::numeric * used/source_qty,2);
    discount := round((src->>'discountAmount')::numeric * (used+qty)/source_qty,2) - round((src->>'discountAmount')::numeric * used/source_qty,2);
    amount := taxable+cgst+sgst+igst;
    line := src || jsonb_build_object('sourceIndex',idx,'quantity',qty,'discountAmount',discount,'taxable',taxable,'cgst',cgst,'sgst',sgst,'igst',igst,'amount',amount);
    IF treatment = 'commercial' THEN
      line := line || jsonb_build_object('unitPrice',amount/qty,'discountPct',0,'discountAmount',0,'gstRate',0,'taxable',amount,'cgst',0,'sgst',0,'igst',0);
    END IF;
    lines := lines || jsonb_build_array(line); subtotal := subtotal + amount;
  END LOOP;
  SELECT coalesce(sum((totals->>'subTotal')::numeric),0), coalesce(sum(total_amount),0) INTO prior_subtotal, prior_total FROM public.credit_notes WHERE invoice_id = inv.id;
  original_subtotal := (inv.totals->>'subTotal')::numeric; original_round := (inv.totals->>'roundOff')::numeric;
  IF original_subtotal <= 0 THEN RAISE EXCEPTION 'Invoice has no creditable value.'; END IF;
  round_off := round(original_round*(prior_subtotal+subtotal)/original_subtotal,2) - round(original_round*prior_subtotal/original_subtotal,2);
  total := subtotal + round_off;
  IF total <= 0 OR total + prior_total > inv.total_amount THEN RAISE EXCEPTION 'Credit exceeds the remaining invoice value or has no value.'; END IF;
  SELECT jsonb_agg(x ORDER BY (x->>'rate')::numeric) INTO tax_summary FROM (
    SELECT jsonb_build_object('rate',(l->>'gstRate')::numeric,'taxable',sum((l->>'taxable')::numeric),'cgst',sum((l->>'cgst')::numeric),'sgst',sum((l->>'sgst')::numeric),'igst',sum((l->>'igst')::numeric)) x
    FROM jsonb_array_elements(lines) l GROUP BY (l->>'gstRate')::numeric
  ) t;
  -- All manual and automatic issuance serializes on the settings row, avoiding collisions.
  SELECT * INTO settings FROM public.sales_settings WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sales settings are missing.'; END IF;
  IF manual IS NOT NULL THEN
    IF manual !~ '^[A-Za-z0-9/-]{1,16}$' THEN RAISE EXCEPTION 'Number must contain 1-16 letters, numbers, / or -.'; END IF;
    number := manual;
    IF EXISTS (SELECT 1 FROM public.credit_notes WHERE credit_note_number = number) THEN RAISE EXCEPTION 'Credit note number already exists.'; END IF;
  ELSE
    seq_num := CASE WHEN settings.credit_note_fy IS DISTINCT FROM fy THEN 1 ELSE settings.credit_note_next_number END;
    LOOP
      -- greatest() prevents PostgreSQL lpad from truncating numbers wider than the configured digits.
      number := settings.credit_note_prefix || '/' || fy || '/' || lpad(seq_num::text, greatest(settings.credit_note_pad,length(seq_num::text)), '0');
      IF length(number) > 16 THEN RAISE EXCEPTION 'Auto number exceeds 16 characters. Shorten the prefix in Sales Settings.'; END IF;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.credit_notes WHERE credit_note_number = number);
      seq_num := seq_num + 1;
    END LOOP;
    UPDATE public.sales_settings SET credit_note_fy = fy, credit_note_next_number = seq_num+1, updated_at = now() WHERE id = true;
  END IF;
  INSERT INTO public.credit_notes(request_id, credit_note_number, credit_note_fy, seq, numbering_mode, invoice_id, invoice_number, invoice_date, credit_note_date, user_id, reason, treatment, bill_to, place_of_supply, items, totals, total_amount, seller_snapshot, created_by)
  SELECT (p_input->>'requestId')::uuid,number,CASE WHEN manual IS NULL THEN fy END,seq_num,CASE WHEN manual IS NULL THEN 'auto' ELSE 'manual' END,
    inv.id,inv.invoice_number,inv.invoice_date,note_date,inv.user_id,btrim(p_input->>'reason'),treatment,inv.bill_to,inv.place_of_supply,lines,
    jsonb_build_object('quantity',sum((l->>'quantity')::numeric),'discountTotal',sum((l->>'discountAmount')::numeric),'taxableTotal',sum((l->>'taxable')::numeric),
      'cgstTotal',sum((l->>'cgst')::numeric),'sgstTotal',sum((l->>'sgst')::numeric),'igstTotal',sum((l->>'igst')::numeric),
      'subTotal',subtotal,'roundOff',round_off,'total',total,'youSaved',0,'taxSummary',tax_summary),total,to_jsonb(settings),p_actor
    FROM jsonb_array_elements(lines) l RETURNING * INTO note;
  RETURN note;
END $$;
REVOKE ALL ON FUNCTION public.issue_credit_note(jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(jsonb,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.protect_credit_note(), public.protect_credited_invoice() FROM PUBLIC, anon, authenticated;
COMMIT;
