-- =============================================================================
-- 20261024_ledger.sql
-- General Ledger and Party Ledger: double-entry books that post themselves.
-- =============================================================================
-- Requires 20261010 .. 20261023 (invoices, credit notes, payments, debit notes).
-- Run once, after those. The backfill at the end only posts documents that have no
-- entry yet, so a second run does not double-count.
--
--   ledger_accounts     chart of accounts: system accounts + bank / cash accounts (Sales Settings)
--   ledger_entries      one row per voucher. Never edited or deleted: a cancel or an edit adds a
--                       reversal entry, so every change stays in the books (audit trail).
--   ledger_lines        the debit / credit rows of each entry; party = customer or manufacturer
--   supplier_payments   Payments Made to manufacturers
--
-- POSTING (inside the database, in the same transaction as the document)
--   invoice issued        Dr Trade Receivables (customer)   Cr Sales, Output CGST/SGST/IGST, Round Off
--   credit note (GST)     Dr Sales Returns, Output GST      Cr Trade Receivables (customer)
--   credit note (commercial)  Dr Discount Allowed           Cr Trade Receivables (customer)
--   debit note            Dr Trade Receivables (customer)   Cr Sales, Output GST, Round Off
--   receipt               Dr Bank / Cash                    Cr Trade Receivables (customer), one line per allocation
--   payment made          Dr Trade Payables (manufacturer)  Cr Bank / Cash
--   journal / opening     admin entered, debit = credit (opening balances go against Opening Balance Adjustment)
--   edit or cancel        the live entry is reversed (same date) and, for an edit, the new one posted
--
-- Credit notes do not change Payments Received balances (invoice_payment_summary is untouched);
-- they only credit the customer in the books.
--
-- A reversal always keeps the original date, so a cancelled document nets to zero on its own
-- date and no earlier balance ever moves. Nothing can be posted, reversed or edited on or before
-- sales_settings.books_locked_until.
-- =============================================================================

BEGIN;

-- 1. Settings ----------------------------------------------------------------------------------
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS books_locked_until date,
  ADD COLUMN IF NOT EXISTS tally_company_name text,
  ADD COLUMN IF NOT EXISTS journal_prefix text NOT NULL DEFAULT 'SI/JV',
  ADD COLUMN IF NOT EXISTS journal_fy text,
  ADD COLUMN IF NOT EXISTS journal_next_number integer NOT NULL DEFAULT 1 CHECK (journal_next_number >= 1),
  ADD COLUMN IF NOT EXISTS journal_pad integer NOT NULL DEFAULT 2 CHECK (journal_pad BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS supplier_payment_prefix text NOT NULL DEFAULT 'SI/PAY',
  ADD COLUMN IF NOT EXISTS supplier_payment_fy text,
  ADD COLUMN IF NOT EXISTS supplier_payment_next_number integer NOT NULL DEFAULT 1 CHECK (supplier_payment_next_number >= 1),
  ADD COLUMN IF NOT EXISTS supplier_payment_pad integer NOT NULL DEFAULT 2 CHECK (supplier_payment_pad BETWEEN 1 AND 8);

COMMENT ON COLUMN public.sales_settings.books_locked_until IS
  'Books are closed up to and including this date: nothing can be posted, edited or cancelled on or before it.';
COMMENT ON COLUMN public.sales_settings.tally_company_name IS
  'Company name in Tally, sent with the Tally export so the data goes into that company. NULL = the company open in Tally.';

-- Same as 20261022, with the journal voucher and payment made series added.
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
  IF p_series IS NULL OR p_series NOT IN ('invoice', 'po', 'rfq', 'quote', 'receipt', 'debit_note', 'order',
                                          'journal', 'supplier_payment') THEN
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

-- 2. Chart of accounts -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  code            text        NOT NULL CHECK (code ~ '^[0-9]{3,6}$'),
  name            text        NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  type            text        NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  -- receivable / payable carry a party on every line; bank / cash are where money is received or paid.
  kind            text        NOT NULL DEFAULT 'general'
                              CHECK (kind IN ('general', 'receivable', 'payable', 'bank', 'cash')),
  -- Accounts the app posts to by itself. They can be renamed, never removed or re-typed.
  system_key      text        UNIQUE,
  -- Name of the matching ledger in Tally (NULL = same name) and its Tally group, for the Tally export.
  tally_name      text        CHECK (tally_name IS NULL OR length(btrim(tally_name)) BETWEEN 1 AND 100),
  tally_group     text        NOT NULL,
  -- Bank accounts only: printed details, like the invoice bank details.
  bank_name       text,
  account_no      text,
  ifsc            text,
  branch          text,
  account_holder  text,
  -- The bank / cash account used when a receipt does not say where the money went.
  is_default      boolean     NOT NULL DEFAULT false,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT ledger_accounts_code_key UNIQUE (code),
  CONSTRAINT ledger_accounts_default_kind CHECK (NOT is_default OR kind IN ('bank', 'cash')),
  CONSTRAINT ledger_accounts_default_active CHECK (NOT is_default OR active),
  CONSTRAINT ledger_accounts_kind_type CHECK (
    kind = 'general' OR type = CASE kind WHEN 'payable' THEN 'liability' ELSE 'asset' END)
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_name_key ON public.ledger_accounts (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_one_default ON public.ledger_accounts (kind) WHERE is_default;

COMMENT ON TABLE public.ledger_accounts IS
  'Chart of accounts. Bank and cash accounts are managed in Sales Settings; system accounts are posted to automatically.';

INSERT INTO public.ledger_accounts (code, name, type, kind, system_key, tally_name, tally_group, is_default) VALUES
  ('1100', 'Trade Receivables',          'asset',     'receivable', 'receivables',      NULL,           'Sundry Debtors',   false),
  ('1200', 'Cash in Hand',               'asset',     'cash',       'cash',             'Cash',         'Cash-in-Hand',     true),
  ('1300', 'TDS Receivable',             'asset',     'general',    'tds_receivable',   NULL,           'Current Assets',   false),
  ('1400', 'Input CGST',                 'asset',     'general',    'input_cgst',       NULL,           'Duties & Taxes',   false),
  ('1410', 'Input SGST',                 'asset',     'general',    'input_sgst',       NULL,           'Duties & Taxes',   false),
  ('1420', 'Input IGST',                 'asset',     'general',    'input_igst',       NULL,           'Duties & Taxes',   false),
  ('2000', 'Trade Payables',             'liability', 'payable',    'payables',         NULL,           'Sundry Creditors', false),
  ('2100', 'Output CGST',                'liability', 'general',    'output_cgst',      NULL,           'Duties & Taxes',   false),
  ('2110', 'Output SGST',                'liability', 'general',    'output_sgst',      NULL,           'Duties & Taxes',   false),
  ('2120', 'Output IGST',                'liability', 'general',    'output_igst',      NULL,           'Duties & Taxes',   false),
  ('2900', 'Suspense',                   'liability', 'general',    'suspense',         'Suspense A/c', 'Suspense A/c',     false),
  ('3100', 'Capital Account',            'equity',    'general',    'capital',          'Capital',      'Capital Account',  false),
  ('3900', 'Opening Balance Adjustment', 'equity',    'general',    'opening_balance',  NULL,           'Capital Account',  false),
  ('4100', 'Sales',                      'income',    'general',    'sales',            NULL,           'Sales Accounts',   false),
  ('4110', 'Sales Returns',              'income',    'general',    'sales_returns',    NULL,           'Sales Accounts',   false),
  ('4900', 'Round Off',                  'expense',   'general',    'round_off',        NULL,           'Indirect Expenses', false),
  ('5000', 'Purchases',                  'expense',   'general',    'purchases',        NULL,           'Purchase Accounts', false),
  ('5100', 'Discount Allowed',           'expense',   'general',    'discount_allowed', NULL,           'Indirect Expenses', false),
  ('5200', 'Bank Charges',               'expense',   'general',    'bank_charges',     NULL,           'Indirect Expenses', false),
  ('5300', 'Bad Debts',                  'expense',   'general',    'bad_debts',        NULL,           'Indirect Expenses', false)
ON CONFLICT (system_key) DO NOTHING;

-- The first bank account comes from the invoice bank details in Sales Settings.
INSERT INTO public.ledger_accounts (code, name, type, kind, tally_group, bank_name, account_no, ifsc, branch, account_holder, is_default)
SELECT '1210', coalesce(nullif(btrim(s.bank_name), ''), 'Bank Account'), 'asset', 'bank', 'Bank Accounts',
       nullif(btrim(s.bank_name), ''), nullif(btrim(s.account_no), ''), nullif(btrim(s.ifsc), ''),
       nullif(btrim(s.bank_address), ''), nullif(btrim(s.account_holder), ''), true
  FROM public.sales_settings s
 WHERE s.id = true
   AND NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE kind = 'bank');
INSERT INTO public.ledger_accounts (code, name, type, kind, tally_group, is_default)
SELECT '1210', 'Bank Account', 'asset', 'bank', 'Bank Accounts', true
 WHERE NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE kind = 'bank');

-- 3. Entries and lines ----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  -- Posting order (ties on the same date are shown in the order they were posted).
  seq                bigint      GENERATED ALWAYS AS IDENTITY,
  entry_date         date        NOT NULL,
  fy                 text        NOT NULL,
  voucher_type       text        NOT NULL CHECK (voucher_type IN ('invoice', 'credit_note', 'debit_note', 'receipt',
                                                                  'supplier_payment', 'journal', 'opening')),
  voucher_number     text        NOT NULL,
  -- The document this entry was posted from (NULL for journal / opening entries, which are their own document).
  source_id          uuid,
  party_id           uuid        REFERENCES public.profiles(id) ON DELETE RESTRICT,
  narration          text,
  is_reversal        boolean     NOT NULL DEFAULT false,
  reverses_entry_id  uuid        REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
  reversed_by        uuid        REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
  reversed_at        timestamptz,
  reversal_reason    text,
  -- md5 of date, number, party and lines: a re-post with the same content is skipped.
  fingerprint        text,
  -- Idempotency for admin-entered vouchers (journal / opening).
  request_id         uuid        UNIQUE,
  created_by         uuid        REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_pkey PRIMARY KEY (id),
  CONSTRAINT ledger_entries_reversal_ref CHECK (is_reversal = (reverses_entry_id IS NOT NULL)),
  CONSTRAINT ledger_entries_reversed_consistent CHECK ((reversed_by IS NULL) = (reversed_at IS NULL)),
  CONSTRAINT ledger_entries_reversal_once UNIQUE (reverses_entry_id),
  CONSTRAINT ledger_entries_source CHECK (voucher_type IN ('journal', 'opening') OR source_id IS NOT NULL)
);
-- At most one live (posted, not reversed) entry per document.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_one_live ON public.ledger_entries (voucher_type, source_id)
  WHERE source_id IS NOT NULL AND NOT is_reversal AND reversed_by IS NULL;
CREATE INDEX IF NOT EXISTS ledger_entries_date ON public.ledger_entries (entry_date, seq);
CREATE INDEX IF NOT EXISTS ledger_entries_source ON public.ledger_entries (source_id);
CREATE INDEX IF NOT EXISTS ledger_entries_party ON public.ledger_entries (party_id);

CREATE TABLE IF NOT EXISTS public.ledger_lines (
  id          uuid          NOT NULL DEFAULT gen_random_uuid(),
  entry_id    uuid          NOT NULL REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
  line_no     smallint      NOT NULL,
  -- Copy of the entry's date, so balances by date need no join.
  entry_date  date          NOT NULL,
  account_id  uuid          NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  party_id    uuid          REFERENCES public.profiles(id) ON DELETE RESTRICT,
  debit       numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  -- Bill this line belongs to (invoice / debit note number), and how: a new bill, against a bill,
  -- an advance or on account. Used for bill-wise details in the Tally export.
  bill_ref    text,
  bill_type   text          CHECK (bill_type IN ('new', 'against', 'advance', 'on_account')),
  narration   text,
  CONSTRAINT ledger_lines_pkey PRIMARY KEY (id),
  CONSTRAINT ledger_lines_entry_line UNIQUE (entry_id, line_no),
  CONSTRAINT ledger_lines_one_side CHECK ((debit > 0) <> (credit > 0))
);
CREATE INDEX IF NOT EXISTS ledger_lines_account_date ON public.ledger_lines (account_id, entry_date);
CREATE INDEX IF NOT EXISTS ledger_lines_party_date ON public.ledger_lines (party_id, entry_date) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_lines_date ON public.ledger_lines (entry_date);

COMMENT ON TABLE public.ledger_entries IS
  'One row per voucher. Insert only: a cancel or edit adds a reversal entry (same date) instead of changing history.';

-- 4. The books can't be rewritten ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- The only change ever made: marking an entry as reversed, once.
  IF TG_OP = 'UPDATE' AND OLD.reversed_by IS NULL AND NEW.reversed_by IS NOT NULL
     AND (to_jsonb(NEW) - 'reversed_by' - 'reversed_at') = (to_jsonb(OLD) - 'reversed_by' - 'reversed_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'LEDGER_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_ledger_entry ON public.ledger_entries;
CREATE TRIGGER protect_ledger_entry BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_ledger_entry();

CREATE OR REPLACE FUNCTION public.protect_ledger_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'LEDGER_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_ledger_line ON public.ledger_lines;
CREATE TRIGGER protect_ledger_line BEFORE UPDATE OR DELETE ON public.ledger_lines
  FOR EACH ROW EXECUTE FUNCTION public.protect_ledger_line();

-- Safety net, checked at commit: every entry's debits equal its credits.
CREATE OR REPLACE FUNCTION public.check_ledger_entry_balanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dr numeric;
  v_cr numeric;
  v_n  integer;
BEGIN
  SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    INTO v_dr, v_cr, v_n
    FROM public.ledger_lines WHERE entry_id = NEW.entry_id;
  IF v_dr <> v_cr OR v_n < 2 THEN
    RAISE EXCEPTION 'LEDGER_UNBALANCED' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('debit', v_dr, 'credit', v_cr)::text;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_lines_balanced ON public.ledger_lines;
CREATE CONSTRAINT TRIGGER ledger_lines_balanced AFTER INSERT ON public.ledger_lines
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_ledger_entry_balanced();

-- Accounts: never deleted (deactivate instead); a system account or one with entries keeps its code,
-- type and kind; a system account stays active.
CREATE OR REPLACE FUNCTION public.protect_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ACCOUNT_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.code, NEW.type, NEW.kind) IS DISTINCT FROM (OLD.code, OLD.type, OLD.kind)
     OR NEW.system_key IS DISTINCT FROM OLD.system_key THEN
    IF OLD.system_key IS NOT NULL OR EXISTS (SELECT 1 FROM public.ledger_lines WHERE account_id = OLD.id) THEN
      RAISE EXCEPTION 'ACCOUNT_LOCKED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF OLD.system_key IS NOT NULL AND NOT NEW.active THEN
    RAISE EXCEPTION 'ACCOUNT_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_ledger_account ON public.ledger_accounts;
CREATE TRIGGER protect_ledger_account BEFORE UPDATE OR DELETE ON public.ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_ledger_account();

-- 5. Posting engine --------------------------------------------------------------------------------------------
-- Financial year of a date, e.g. 2026-10-03 -> '26-27' (April to March).
CREATE OR REPLACE FUNCTION public.ledger_fy(p_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lpad((y % 100)::text, 2, '0') || '-' || lpad(((y + 1) % 100)::text, 2, '0')
    FROM (SELECT CASE WHEN extract(month FROM p_date) < 4 THEN extract(year FROM p_date)::integer - 1
                      ELSE extract(year FROM p_date)::integer END AS y) s;
$$;

-- A number stored in a jsonb document (invoice totals). NULL when missing or not a number.
CREATE OR REPLACE FUNCTION public.ledger_num(p jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p IS NULL OR jsonb_typeof(p) NOT IN ('number', 'string') THEN
    RETURN NULL;
  END IF;
  RETURN (p #>> '{}')::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_account_id(p_key text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v uuid;
BEGIN
  SELECT id INTO v FROM public.ledger_accounts WHERE system_key = p_key;
  IF v IS NULL THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_MISSING' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('key', p_key)::text;
  END IF;
  RETURN v;
END;
$$;

-- Where money was received or paid: the bank / cash account with that name, else the default
-- cash account for a cash payment, else the default bank account.
CREATE OR REPLACE FUNCTION public.ledger_money_account(p_name text, p_mode text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT id FROM public.ledger_accounts
      WHERE kind IN ('bank', 'cash') AND lower(btrim(name)) = lower(btrim(coalesce(p_name, '')))),
    (SELECT id FROM public.ledger_accounts WHERE kind = 'cash' AND is_default AND p_mode = 'cash'),
    (SELECT id FROM public.ledger_accounts WHERE kind = 'bank' AND is_default),
    (SELECT id FROM public.ledger_accounts WHERE kind = 'bank' ORDER BY active DESC, code LIMIT 1),
    public.ledger_account_id('cash'));
$$;

CREATE OR REPLACE FUNCTION public.ledger_assert_open(p_date date)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_locked date;
BEGIN
  SELECT books_locked_until INTO v_locked FROM public.sales_settings WHERE id = true;
  IF v_locked IS NOT NULL AND p_date <= v_locked THEN
    RAISE EXCEPTION 'BOOKS_LOCKED' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('locked_until', v_locked, 'date', p_date)::text;
  END IF;
END;
$$;

-- One line of an entry. Positive amount = debit, negative = credit.
CREATE OR REPLACE FUNCTION public.ledger_line_json(
  p_account uuid, p_party uuid, p_amount numeric, p_ref text DEFAULT NULL, p_bill_type text DEFAULT NULL,
  p_narration text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('a', p_account, 'p', p_party, 'amt', round(coalesce(p_amount, 0), 2),
                            'ref', nullif(btrim(coalesce(p_ref, '')), ''), 'bt', p_bill_type,
                            'nar', nullif(btrim(coalesce(p_narration, '')), ''));
$$;

-- Lines with a zero amount dropped and amounts rounded to paise, order kept.
CREATE OR REPLACE FUNCTION public.ledger_clean_lines(p_lines jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_set(x.l, '{amt}', to_jsonb(round((x.l ->> 'amt')::numeric, 2))) ORDER BY x.o), '[]'::jsonb)
    FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) WITH ORDINALITY AS x(l, o)
   WHERE round(coalesce((x.l ->> 'amt')::numeric, 0), 2) <> 0;
$$;

CREATE OR REPLACE FUNCTION public.ledger_fingerprint(p_date date, p_number text, p_party uuid, p_lines jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT md5(jsonb_build_object('d', p_date, 'n', p_number, 'p', p_party, 'l', public.ledger_clean_lines(p_lines))::text);
$$;

-- Writes one balanced entry and returns its id. Every posting goes through here.
CREATE OR REPLACE FUNCTION public.ledger_write_entry(
  p_type text, p_number text, p_source uuid, p_date date, p_party uuid, p_narration text,
  p_lines jsonb, p_actor uuid, p_request uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lines jsonb := public.ledger_clean_lines(p_lines);
  v_sum   numeric;
  v_bad   integer;
  v_id    uuid;
BEGIN
  IF p_date IS NULL OR nullif(btrim(coalesce(p_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.ledger_assert_open(p_date);

  SELECT coalesce(sum((l ->> 'amt')::numeric), 0) INTO v_sum FROM jsonb_array_elements(v_lines) AS x(l);
  IF jsonb_array_length(v_lines) < 2 OR v_sum <> 0 THEN
    RAISE EXCEPTION 'LEDGER_UNBALANCED' USING ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('difference', v_sum)::text;
  END IF;

  -- Every account exists; a party only on a receivable / payable account.
  SELECT count(*) INTO v_bad
    FROM jsonb_array_elements(v_lines) AS x(l)
    LEFT JOIN public.ledger_accounts a ON a.id = (x.l ->> 'a')::uuid
   WHERE a.id IS NULL OR (x.l ->> 'p' IS NOT NULL AND a.kind NOT IN ('receivable', 'payable'));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'LEDGER_INVALID_LINE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ledger_entries (entry_date, fy, voucher_type, voucher_number, source_id, party_id, narration,
                                     fingerprint, request_id, created_by)
  VALUES (p_date, public.ledger_fy(p_date), p_type, btrim(p_number), p_source, p_party, nullif(btrim(coalesce(p_narration, '')), ''),
          public.ledger_fingerprint(p_date, p_number, p_party, v_lines), p_request, p_actor)
  RETURNING id INTO v_id;

  INSERT INTO public.ledger_lines (entry_id, line_no, entry_date, account_id, party_id, debit, credit, bill_ref, bill_type, narration)
  SELECT v_id, x.o, p_date, (x.l ->> 'a')::uuid, (x.l ->> 'p')::uuid,
         greatest((x.l ->> 'amt')::numeric, 0), greatest(-(x.l ->> 'amt')::numeric, 0),
         x.l ->> 'ref', x.l ->> 'bt', x.l ->> 'nar'
    FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS x(l, o);

  RETURN v_id;
END;
$$;

-- Undoes an entry with a mirror entry on the same date. Returns the reversal's id
-- (NULL when the entry was already reversed or is itself a reversal).
CREATE OR REPLACE FUNCTION public.ledger_reverse_entry(p_entry uuid, p_reason text, p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e    public.ledger_entries;
  v_id uuid;
BEGIN
  SELECT * INTO e FROM public.ledger_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF e.is_reversal OR e.reversed_by IS NOT NULL THEN
    RETURN NULL;
  END IF;
  PERFORM public.ledger_assert_open(e.entry_date);

  INSERT INTO public.ledger_entries (entry_date, fy, voucher_type, voucher_number, source_id, party_id, narration,
                                     is_reversal, reverses_entry_id, reversal_reason, created_by)
  VALUES (e.entry_date, e.fy, e.voucher_type, e.voucher_number, e.source_id, e.party_id,
          'Reversal of ' || e.voucher_number || coalesce(': ' || nullif(btrim(coalesce(p_reason, '')), ''), ''),
          true, e.id, nullif(btrim(coalesce(p_reason, '')), ''), p_actor)
  RETURNING id INTO v_id;

  INSERT INTO public.ledger_lines (entry_id, line_no, entry_date, account_id, party_id, debit, credit, bill_ref, bill_type, narration)
  SELECT v_id, line_no, entry_date, account_id, party_id, credit, debit, bill_ref, bill_type, narration
    FROM public.ledger_lines WHERE entry_id = e.id;

  UPDATE public.ledger_entries SET reversed_by = v_id, reversed_at = now() WHERE id = e.id;
  RETURN v_id;
END;
$$;

-- Makes the books match a document: nothing changes when the live entry already has the same
-- content; otherwise the live entry is reversed and (unless p_lines is NULL) the new one posted.
CREATE OR REPLACE FUNCTION public.ledger_sync(
  p_type text, p_source uuid, p_number text, p_date date, p_party uuid, p_narration text,
  p_lines jsonb, p_actor uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_live public.ledger_entries;
BEGIN
  SELECT * INTO v_live FROM public.ledger_entries
   WHERE voucher_type = p_type AND source_id = p_source AND NOT is_reversal AND reversed_by IS NULL
   FOR UPDATE;

  IF p_lines IS NULL OR jsonb_array_length(public.ledger_clean_lines(p_lines)) = 0 THEN
    IF v_live.id IS NOT NULL THEN
      PERFORM public.ledger_reverse_entry(v_live.id, p_reason, p_actor);
    END IF;
    RETURN NULL;
  END IF;

  IF v_live.id IS NOT NULL THEN
    IF v_live.fingerprint = public.ledger_fingerprint(p_date, p_number, p_party, p_lines) THEN
      RETURN v_live.id;
    END IF;
    PERFORM public.ledger_reverse_entry(v_live.id, p_reason, p_actor);
  END IF;

  RETURN public.ledger_write_entry(p_type, p_number, p_source, p_date, p_party, p_narration, p_lines, p_actor);
END;
$$;

-- The lines of a GST document (invoice, debit note, credit note) from its stored totals.
-- p_sign = 1 debits the customer (sale), -1 credits them (credit note).
CREATE OR REPLACE FUNCTION public.ledger_gst_document_lines(
  p_party uuid, p_total numeric, p_totals jsonb, p_value_account text, p_sign integer, p_ref text, p_bill_type text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_total   numeric := round(coalesce(p_total, 0), 2);
  v_cgst    numeric := round(coalesce(public.ledger_num(p_totals -> 'cgstTotal'), 0), 2);
  v_sgst    numeric := round(coalesce(public.ledger_num(p_totals -> 'sgstTotal'), 0), 2);
  v_igst    numeric := round(coalesce(public.ledger_num(p_totals -> 'igstTotal'), 0), 2);
  v_taxable numeric;
  v_round   numeric;
BEGIN
  IF v_total <= 0 THEN
    RETURN NULL;
  END IF;
  v_taxable := round(coalesce(public.ledger_num(p_totals -> 'taxableTotal'), v_total - v_cgst - v_sgst - v_igst), 2);
  v_round := v_total - v_taxable - v_cgst - v_sgst - v_igst;
  -- Rounding to the rupee is under a rupee. A bigger gap is old data with incomplete totals:
  -- keep it in the value line rather than in Round Off.
  IF abs(v_round) >= 1 THEN
    v_taxable := v_taxable + v_round;
    v_round := 0;
  END IF;
  RETURN jsonb_build_array(
    public.ledger_line_json(public.ledger_account_id('receivables'), p_party, p_sign * v_total, p_ref, p_bill_type),
    public.ledger_line_json(public.ledger_account_id(p_value_account), NULL, -p_sign * v_taxable),
    public.ledger_line_json(public.ledger_account_id('output_cgst'), NULL, -p_sign * v_cgst),
    public.ledger_line_json(public.ledger_account_id('output_sgst'), NULL, -p_sign * v_sgst),
    public.ledger_line_json(public.ledger_account_id('output_igst'), NULL, -p_sign * v_igst),
    public.ledger_line_json(public.ledger_account_id('round_off'), NULL, -p_sign * v_round));
END;
$$;

-- 6. Each document posts itself ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ledger_sync_invoice(p_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.invoices;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = p_id;
  IF NOT FOUND THEN
    PERFORM public.ledger_sync('invoice', p_id, NULL, NULL, NULL, NULL, NULL, p_actor, 'Invoice deleted');
    RETURN;
  END IF;
  PERFORM public.ledger_sync(
    'invoice', inv.id, inv.invoice_number, inv.invoice_date, inv.user_id,
    'Sales invoice ' || inv.invoice_number || coalesce(' - ' || nullif(btrim(inv.bill_to ->> 'name'), ''), ''),
    CASE WHEN inv.status = 'issued'
         THEN public.ledger_gst_document_lines(inv.user_id, inv.total_amount, inv.totals, 'sales', 1, inv.invoice_number, 'new') END,
    coalesce(p_actor, inv.created_by),
    CASE WHEN inv.status = 'cancelled' THEN 'Invoice cancelled' ELSE 'Invoice edited' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_sync_credit_note(p_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cn public.credit_notes;
BEGIN
  SELECT * INTO cn FROM public.credit_notes WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM public.ledger_sync(
    'credit_note', cn.id, cn.credit_note_number, cn.credit_note_date, cn.user_id,
    'Credit note ' || cn.credit_note_number || ' against invoice ' || cn.invoice_number,
    CASE WHEN cn.status = 'issued'
         THEN public.ledger_gst_document_lines(cn.user_id, cn.total_amount, cn.totals,
                CASE WHEN cn.treatment = 'commercial' THEN 'discount_allowed' ELSE 'sales_returns' END,
                -1, cn.invoice_number, 'against') END,
    coalesce(p_actor, cn.created_by), 'Credit note withdrawn');
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_sync_debit_note(p_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dn public.debit_notes;
BEGIN
  SELECT * INTO dn FROM public.debit_notes WHERE id = p_id;
  IF NOT FOUND THEN
    PERFORM public.ledger_sync('debit_note', p_id, NULL, NULL, NULL, NULL, NULL, p_actor, 'Debit note deleted');
    RETURN;
  END IF;
  PERFORM public.ledger_sync(
    'debit_note', dn.id, dn.debit_note_number, dn.debit_note_date, dn.user_id,
    'Debit note ' || dn.debit_note_number || ' against invoice ' || dn.invoice_number,
    CASE WHEN dn.status = 'issued'
         THEN public.ledger_gst_document_lines(dn.user_id, dn.total_amount, dn.totals, 'sales', 1, dn.debit_note_number, 'new') END,
    coalesce(p_actor, dn.created_by),
    coalesce('Debit note cancelled: ' || dn.cancel_reason, 'Debit note cancelled'));
END;
$$;

-- A receipt credits the customer once per allocation (so each invoice / debit note it paid shows),
-- and debits the bank or cash account named in "Deposited in".
CREATE OR REPLACE FUNCTION public.ledger_sync_receipt(p_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p       public.payments;
  v_recv  uuid;
  v_lines jsonb;
  v_alloc numeric;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = p_id;
  IF NOT FOUND OR p.status <> 'received' THEN
    PERFORM public.ledger_sync('receipt', p_id, NULL, NULL, NULL, NULL, NULL, coalesce(p_actor, p.created_by),
                               coalesce('Receipt cancelled: ' || p.cancel_reason, 'Receipt cancelled'));
    RETURN;
  END IF;

  v_recv := public.ledger_account_id('receivables');
  SELECT coalesce(jsonb_agg(public.ledger_line_json(
           v_recv, p.user_id, -a.amount,
           CASE a.kind WHEN 'invoice' THEN a.invoice_number WHEN 'debit_note' THEN a.debit_note_number END,
           CASE a.kind WHEN 'invoice' THEN 'against' WHEN 'debit_note' THEN 'against'
                       WHEN 'advance' THEN 'advance' ELSE 'on_account' END,
           CASE a.kind WHEN 'other' THEN a.note END)
           ORDER BY a.kind, coalesce(a.invoice_number, a.debit_note_number, ''), a.amount, a.id), '[]'::jsonb),
         coalesce(sum(a.amount), 0)
    INTO v_lines, v_alloc
    FROM public.payment_allocations a
   WHERE a.payment_id = p.id;

  -- record_payment makes the allocations add up to the amount; keep any gap on account rather than fail.
  IF v_alloc <> p.amount THEN
    v_lines := v_lines || jsonb_build_array(public.ledger_line_json(v_recv, p.user_id, -(p.amount - v_alloc), NULL, 'on_account'));
  END IF;

  PERFORM public.ledger_sync(
    'receipt', p.id, p.receipt_number, p.payment_date, p.user_id,
    'Receipt ' || p.receipt_number || ' from ' || p.payer_name || ' (' || replace(p.mode, '_', ' ') || ')'
      || coalesce(', ref ' || nullif(btrim(p.reference), ''), ''),
    jsonb_build_array(public.ledger_line_json(public.ledger_money_account(p.deposit_account, p.mode), NULL, p.amount)) || v_lines,
    coalesce(p_actor, p.created_by), 'Receipt changed');
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ledger_sync_invoice(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, auth.uid());
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_invoice_insert ON public.invoices;
DROP TRIGGER IF EXISTS ledger_invoice_update ON public.invoices;
CREATE TRIGGER ledger_invoice_insert AFTER INSERT OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_invoice();
-- Only changes that move money re-post (stock bookkeeping updates do not).
CREATE TRIGGER ledger_invoice_update AFTER UPDATE ON public.invoices
  FOR EACH ROW
  WHEN ((OLD.status, OLD.total_amount, OLD.totals, OLD.invoice_date, OLD.user_id, OLD.invoice_number)
        IS DISTINCT FROM (NEW.status, NEW.total_amount, NEW.totals, NEW.invoice_date, NEW.user_id, NEW.invoice_number))
  EXECUTE FUNCTION public.ledger_on_invoice();

CREATE OR REPLACE FUNCTION public.ledger_on_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ledger_sync_credit_note(NEW.id, auth.uid());
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_credit_note ON public.credit_notes;
CREATE TRIGGER ledger_credit_note AFTER INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_credit_note();

CREATE OR REPLACE FUNCTION public.ledger_on_debit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ledger_sync_debit_note(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, auth.uid());
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_debit_note ON public.debit_notes;
CREATE TRIGGER ledger_debit_note AFTER INSERT OR UPDATE OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_debit_note();

-- record_payment stores the receipt first and then all its allocations in one INSERT, so a receipt
-- posts once its allocations are in (statement trigger), and again when it is cancelled.
CREATE OR REPLACE FUNCTION public.ledger_on_payment_allocations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT payment_id FROM new_allocations ORDER BY payment_id LOOP
    PERFORM public.ledger_sync_receipt(r.payment_id, auth.uid());
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_payment_allocations ON public.payment_allocations;
CREATE TRIGGER ledger_payment_allocations AFTER INSERT ON public.payment_allocations
  REFERENCING NEW TABLE AS new_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION public.ledger_on_payment_allocations();

CREATE OR REPLACE FUNCTION public.ledger_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ledger_sync_receipt(NEW.id, auth.uid());
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_payment ON public.payments;
CREATE TRIGGER ledger_payment AFTER UPDATE ON public.payments
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.ledger_on_payment();

-- 7. Payments Made (to manufacturers) --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),
  request_id            uuid          NOT NULL UNIQUE,
  voucher_number        text          NOT NULL UNIQUE,
  voucher_fy            text,
  seq                   integer,
  payment_date          date          NOT NULL,
  manufacturer_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payee_name            text          NOT NULL CHECK (length(btrim(payee_name)) > 0),
  amount                numeric(14, 2) NOT NULL CHECK (amount > 0),
  mode                  text          NOT NULL CHECK (mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'net_banking',
                                                             'demand_draft', 'wallet', 'payment_gateway', 'other')),
  reference             text,                                -- UTR / cheque no. / transaction id
  paid_from_account_id  uuid          NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  paid_from_name        text          NOT NULL,              -- snapshot of the bank / cash account name
  bill_reference        text,                                -- manufacturer's bill or PO numbers
  remarks               text,
  status                text          NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled')),
  cancelled_at          timestamptz,
  cancel_reason         text,
  created_by            uuid          REFERENCES auth.users(id),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payments_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_payments_cancel_consistent CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_manufacturer ON public.supplier_payments (manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON public.supplier_payments (payment_date DESC);

COMMENT ON TABLE public.supplier_payments IS
  'Payments made to manufacturers. Each one debits the manufacturer (Trade Payables) and credits the bank / cash account.';

-- Like receipts: a payment made can only be cancelled (with a reason), never edited or deleted.
CREATE OR REPLACE FUNCTION public.protect_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status = 'cancelled'
     AND (to_jsonb(NEW) - 'status' - 'cancelled_at' - 'cancel_reason')
       = (to_jsonb(OLD) - 'status' - 'cancelled_at' - 'cancel_reason') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS protect_supplier_payment ON public.supplier_payments;
CREATE TRIGGER protect_supplier_payment BEFORE UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_supplier_payment();

CREATE OR REPLACE FUNCTION public.ledger_sync_supplier_payment(p_id uuid, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sp public.supplier_payments;
BEGIN
  SELECT * INTO sp FROM public.supplier_payments WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM public.ledger_sync(
    'supplier_payment', sp.id, sp.voucher_number, sp.payment_date, sp.manufacturer_id,
    'Payment ' || sp.voucher_number || ' to ' || sp.payee_name || ' (' || replace(sp.mode, '_', ' ') || ')'
      || coalesce(', ref ' || nullif(btrim(sp.reference), ''), ''),
    CASE WHEN sp.status = 'paid' THEN jsonb_build_array(
      public.ledger_line_json(public.ledger_account_id('payables'), sp.manufacturer_id, sp.amount, NULL, 'on_account',
                              CASE WHEN nullif(btrim(coalesce(sp.bill_reference, '')), '') IS NOT NULL
                                   THEN 'Against ' || btrim(sp.bill_reference) END),
      public.ledger_line_json(sp.paid_from_account_id, NULL, -sp.amount)) END,
    coalesce(p_actor, sp.created_by),
    coalesce('Payment cancelled: ' || sp.cancel_reason, 'Payment cancelled'));
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_on_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ledger_sync_supplier_payment(NEW.id, auth.uid());
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_supplier_payment ON public.supplier_payments;
CREATE TRIGGER ledger_supplier_payment AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_supplier_payment();

-- Records a payment made to a manufacturer and posts it. A retry with the same request_id
-- returns the same payment.
CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_input jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req      uuid;
  v_maker    uuid;
  v_account  uuid;
  v_date     date;
  v_amount   numeric(14, 2);
  v_mode     text := p_input ->> 'mode';
  v_today    date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_existing public.supplier_payments;
  v_payee    text;
  v_acc      public.ledger_accounts;
  v_number   text;
  v_parts    text[];
  v_tries    integer := 0;
  v_row      public.supplier_payments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_req     := (p_input ->> 'request_id')::uuid;
    v_maker   := (p_input ->> 'manufacturer_id')::uuid;
    v_account := (p_input ->> 'account_id')::uuid;
    v_date    := (p_input ->> 'payment_date')::date;
    v_amount  := (p_input ->> 'amount')::numeric(14, 2);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END;
  IF v_req IS NULL OR v_maker IS NULL OR v_account IS NULL OR v_date IS NULL OR v_amount IS NULL OR v_amount <= 0
     OR v_mode IS NULL OR v_mode NOT IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'net_banking',
                                         'demand_draft', 'wallet', 'payment_gateway', 'other') THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF v_date > v_today OR v_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'PAYMENT_DATE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.supplier_payments WHERE request_id = v_req;
  IF FOUND THEN
    IF v_existing.created_by IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'REQUEST_ID_USED' USING ERRCODE = 'P0001';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  SELECT coalesce(nullif(btrim(nullif(company_name, '-')), ''),
                  nullif(btrim(concat_ws(' ', nullif(first_name, '-'), nullif(last_name, '-'))), ''),
                  email)
    INTO v_payee
    FROM public.profiles WHERE id = v_maker AND role = 'manufacturer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MANUFACTURER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_acc FROM public.ledger_accounts WHERE id = v_account AND kind IN ('bank', 'cash');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_acc.active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('name', v_acc.name)::text;
  END IF;

  LOOP
    v_number := public.next_series_number('supplier_payment');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.supplier_payments WHERE voucher_number = v_number);
    v_tries := v_tries + 1;
    IF v_tries >= 1000 THEN
      RAISE EXCEPTION 'DUPLICATE_VOUCHER_NUMBER' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  v_parts := string_to_array(v_number, '/');

  INSERT INTO public.supplier_payments (request_id, voucher_number, voucher_fy, seq, payment_date, manufacturer_id, payee_name,
                                        amount, mode, reference, paid_from_account_id, paid_from_name, bill_reference, remarks,
                                        created_by)
  VALUES (v_req, v_number, v_parts[array_length(v_parts, 1) - 1],
          CASE WHEN v_parts[array_length(v_parts, 1)] ~ '^[0-9]+$' THEN v_parts[array_length(v_parts, 1)]::integer END,
          v_date, v_maker, v_payee, v_amount, v_mode,
          left(nullif(btrim(coalesce(p_input ->> 'reference', '')), ''), 100), v_acc.id, v_acc.name,
          left(nullif(btrim(coalesce(p_input ->> 'bill_reference', '')), ''), 200),
          left(nullif(btrim(coalesce(p_input ->> 'remarks', '')), ''), 1000), p_actor)
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_payment(p_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.supplier_payments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_row FROM public.supplier_payments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('already_cancelled', true, 'voucher_number', v_row.voucher_number);
  END IF;
  UPDATE public.supplier_payments
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = left(btrim(p_reason), 500)
   WHERE id = p_id;
  RETURN jsonb_build_object('already_cancelled', false, 'voucher_number', v_row.voucher_number, 'amount', v_row.amount);
END;
$$;

-- 8. Journal vouchers and opening balances ----------------------------------------------------------------------
-- p_input: { request_id, kind: 'journal' | 'opening', entry_date, narration,
--            lines: [{ account_id, party_id?, debit?, credit?, bill_ref?, narration? }] }
-- A journal must balance. An opening balance is balanced automatically against
-- Opening Balance Adjustment, so the admin only enters what each party / account had.
CREATE OR REPLACE FUNCTION public.post_journal(p_input jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_uuid_re  CONSTANT text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_req      uuid;
  v_date     date;
  v_kind     text := coalesce(p_input ->> 'kind', 'journal');
  v_narr     text := nullif(btrim(coalesce(p_input ->> 'narration', '')), '');
  v_today    date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_existing public.ledger_entries;
  v_line     jsonb;
  v_acc      public.ledger_accounts;
  v_party    uuid;
  v_role     text;
  v_dr       numeric(14, 2);
  v_cr       numeric(14, 2);
  v_ref      text;
  v_lines    jsonb := '[]'::jsonb;
  v_sum      numeric := 0;
  v_parties  uuid[] := '{}';
  v_number   text;
  v_tries    integer := 0;
  v_id       uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_req  := (p_input ->> 'request_id')::uuid;
    v_date := (p_input ->> 'entry_date')::date;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END;
  IF v_req IS NULL OR v_date IS NULL OR v_kind NOT IN ('journal', 'opening')
     OR jsonb_typeof(p_input -> 'lines') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_input -> 'lines') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;
  IF v_date > v_today OR v_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'ENTRY_DATE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind = 'journal' AND length(coalesce(v_narr, '')) < 3 THEN
    RAISE EXCEPTION 'NARRATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.ledger_entries WHERE request_id = v_req;
  IF FOUND THEN
    IF v_existing.created_by IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'REQUEST_ID_USED' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'voucher_number', v_existing.voucher_number, 'replayed', true);
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_input -> 'lines') LOOP
    IF coalesce(v_line ->> 'account_id', '') !~* c_uuid_re THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_acc FROM public.ledger_accounts WHERE id = (v_line ->> 'account_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_acc.active THEN
      RAISE EXCEPTION 'ACCOUNT_INACTIVE' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('name', v_acc.name)::text;
    END IF;
    IF v_kind = 'opening' AND v_acc.system_key = 'opening_balance' THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_dr := coalesce(nullif(v_line ->> 'debit', '')::numeric(14, 2), 0);
      v_cr := coalesce(nullif(v_line ->> 'credit', '')::numeric(14, 2), 0);
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
    END;
    IF v_dr < 0 OR v_cr < 0 OR (v_dr > 0) = (v_cr > 0) THEN
      RAISE EXCEPTION 'LINE_AMOUNT_INVALID' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('account', v_acc.name)::text;
    END IF;

    -- Customers sit in Trade Receivables, manufacturers in Trade Payables; no party anywhere else.
    v_party := NULL;
    IF coalesce(v_line ->> 'party_id', '') <> '' THEN
      IF (v_line ->> 'party_id') !~* c_uuid_re THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
      END IF;
      v_party := (v_line ->> 'party_id')::uuid;
    END IF;
    IF v_acc.kind IN ('receivable', 'payable') THEN
      IF v_party IS NULL THEN
        RAISE EXCEPTION 'PARTY_REQUIRED' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('account', v_acc.name)::text;
      END IF;
      SELECT role INTO v_role FROM public.profiles WHERE id = v_party;
      IF v_role IS DISTINCT FROM (CASE v_acc.kind WHEN 'receivable' THEN 'customer' ELSE 'manufacturer' END) THEN
        RAISE EXCEPTION 'PARTY_MISMATCH' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('account', v_acc.name)::text;
      END IF;
      IF NOT v_party = ANY (v_parties) THEN
        v_parties := array_append(v_parties, v_party);
      END IF;
    ELSIF v_party IS NOT NULL THEN
      RAISE EXCEPTION 'PARTY_NOT_ALLOWED' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('account', v_acc.name)::text;
    END IF;

    v_ref := left(nullif(btrim(coalesce(v_line ->> 'bill_ref', '')), ''), 50);
    v_lines := v_lines || jsonb_build_array(public.ledger_line_json(
      v_acc.id, v_party, v_dr - v_cr, v_ref,
      CASE WHEN v_party IS NULL THEN NULL WHEN v_ref IS NOT NULL THEN 'new' ELSE 'on_account' END,
      left(v_line ->> 'narration', 200)));
    v_sum := v_sum + v_dr - v_cr;
  END LOOP;

  IF v_kind = 'opening' THEN
    IF v_sum <> 0 THEN
      v_lines := v_lines || jsonb_build_array(public.ledger_line_json(public.ledger_account_id('opening_balance'), NULL, -v_sum));
    END IF;
    v_narr := coalesce(v_narr, 'Opening balance as on ' || to_char(v_date, 'DD-MM-YYYY'));
  ELSIF v_sum <> 0 THEN
    RAISE EXCEPTION 'JOURNAL_UNBALANCED' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('difference', v_sum)::text;
  END IF;
  IF jsonb_array_length(v_lines) < 2 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_number := public.next_series_number('journal');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ledger_entries
                           WHERE voucher_type IN ('journal', 'opening') AND voucher_number = v_number);
    v_tries := v_tries + 1;
    IF v_tries >= 1000 THEN
      RAISE EXCEPTION 'DUPLICATE_VOUCHER_NUMBER' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_id := public.ledger_write_entry(v_kind, v_number, NULL, v_date,
                                    CASE WHEN cardinality(v_parties) = 1 THEN v_parties[1] END,
                                    left(v_narr, 500), v_lines, p_actor, v_req);
  RETURN jsonb_build_object('id', v_id, 'voucher_number', v_number, 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_journal(p_entry uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.ledger_entries;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('admin', 'platform_owner')) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO e FROM public.ledger_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND OR e.voucher_type NOT IN ('journal', 'opening') OR e.is_reversal THEN
    RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF e.reversed_by IS NOT NULL THEN
    RETURN jsonb_build_object('already_cancelled', true, 'voucher_number', e.voucher_number);
  END IF;
  PERFORM public.ledger_reverse_entry(e.id, left(btrim(p_reason), 500), p_actor);
  RETURN jsonb_build_object('already_cancelled', false, 'voucher_number', e.voucher_number);
END;
$$;

-- Makes one bank / cash account the default for its kind (one default bank, one default cash).
CREATE OR REPLACE FUNCTION public.set_default_money_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acc public.ledger_accounts;
BEGIN
  SELECT * INTO v_acc FROM public.ledger_accounts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_acc.kind NOT IN ('bank', 'cash') THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_acc.active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE' USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('name', v_acc.name)::text;
  END IF;
  UPDATE public.ledger_accounts SET is_default = false WHERE kind = v_acc.kind AND is_default AND id <> p_id;
  UPDATE public.ledger_accounts SET is_default = true WHERE id = p_id;
END;
$$;

-- 9. Reports -----------------------------------------------------------------------------------------------------
-- Per account and party: balance before p_from (opening) and debits / credits from p_from to p_to.
-- Reversed entries and their reversals share a date, so they always net to zero here.
CREATE OR REPLACE FUNCTION public.ledger_balances(p_from date, p_to date)
RETURNS TABLE (account_id uuid, party_id uuid, opening numeric, debit numeric, credit numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT l.account_id, l.party_id,
         coalesce(sum(l.debit - l.credit) FILTER (WHERE l.entry_date < p_from), 0),
         coalesce(sum(l.debit) FILTER (WHERE l.entry_date >= p_from), 0),
         coalesce(sum(l.credit) FILTER (WHERE l.entry_date >= p_from), 0)
    FROM public.ledger_lines l
   WHERE l.entry_date <= p_to
   GROUP BY l.account_id, l.party_id;
$$;

-- Lines in date order with a running balance (opening included). Filter by account, by party, or
-- by "no party" on receivable / payable accounts. Reversed pairs are hidden unless asked for; they
-- net to zero on their own date, so the balances are the same either way.
CREATE OR REPLACE FUNCTION public.ledger_report_lines(
  p_from date, p_to date, p_account uuid DEFAULT NULL, p_party uuid DEFAULT NULL,
  p_unlinked boolean DEFAULT false, p_show_reversed boolean DEFAULT false)
RETURNS TABLE (
  line_id uuid, entry_id uuid, entry_seq bigint, line_no smallint, entry_date date, voucher_type text, voucher_number text,
  source_id uuid, is_reversal boolean, reversed boolean, narration text, line_narration text,
  account_id uuid, account_code text, account_name text, party_id uuid, debit numeric, credit numeric,
  bill_ref text, bill_type text, balance numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH f AS (
    SELECT l.id, l.entry_id, e.seq, l.line_no, l.entry_date, e.voucher_type, e.voucher_number, e.source_id,
           e.is_reversal, (e.reversed_by IS NOT NULL) AS reversed, e.narration, l.narration AS line_narration,
           l.account_id, a.code, a.name, l.party_id, l.debit, l.credit, l.bill_ref, l.bill_type
      FROM public.ledger_lines l
      JOIN public.ledger_entries e ON e.id = l.entry_id
      JOIN public.ledger_accounts a ON a.id = l.account_id
     WHERE l.entry_date <= p_to
       AND (p_account IS NULL OR l.account_id = p_account)
       AND (p_party IS NULL OR l.party_id = p_party)
       AND (NOT p_unlinked OR (l.party_id IS NULL AND a.kind IN ('receivable', 'payable')))
  ), opening AS (
    SELECT coalesce(sum(debit - credit), 0) AS bal FROM f WHERE entry_date < p_from
  )
  SELECT f.id, f.entry_id, f.seq, f.line_no, f.entry_date, f.voucher_type, f.voucher_number, f.source_id,
         f.is_reversal, f.reversed, f.narration, f.line_narration, f.account_id, f.code, f.name, f.party_id,
         f.debit, f.credit, f.bill_ref, f.bill_type,
         (SELECT bal FROM opening) + sum(f.debit - f.credit) OVER (ORDER BY f.entry_date, f.seq, f.line_no ROWS UNBOUNDED PRECEDING)
    FROM f
   WHERE f.entry_date >= p_from AND (p_show_reversed OR (NOT f.is_reversal AND NOT f.reversed))
   ORDER BY f.entry_date, f.seq, f.line_no;
$$;

-- What each customer owes as of a date, aged first-in-first-out: credits (receipts, credit notes)
-- settle the oldest debits first, and what is left is bucketed by its age. "overdue" is the part
-- older than the customer's credit days.
CREATE OR REPLACE FUNCTION public.ledger_receivable_ageing(p_as_of date)
RETURNS TABLE (party_id uuid, due numeric, d0_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, overdue numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH live AS (
    SELECT l.party_id, l.entry_date, l.debit, l.credit, e.seq, l.line_no
      FROM public.ledger_lines l
      JOIN public.ledger_entries e ON e.id = l.entry_id
      JOIN public.ledger_accounts a ON a.id = l.account_id
     WHERE a.kind = 'receivable' AND l.party_id IS NOT NULL AND l.entry_date <= p_as_of
       AND NOT e.is_reversal AND e.reversed_by IS NULL
  ), paid AS (
    SELECT party_id, sum(credit) AS cr FROM live GROUP BY party_id
  ), debits AS (
    SELECT party_id, entry_date, debit,
           sum(debit) OVER (PARTITION BY party_id ORDER BY entry_date, seq, line_no ROWS UNBOUNDED PRECEDING) AS cum
      FROM live WHERE debit > 0
  ), open_bills AS (
    SELECT d.party_id, d.entry_date, greatest(0, least(d.debit, d.cum - coalesce(p.cr, 0))) AS amt
      FROM debits d LEFT JOIN paid p ON p.party_id = d.party_id
  )
  SELECT o.party_id,
         sum(o.amt),
         coalesce(sum(o.amt) FILTER (WHERE p_as_of - o.entry_date <= 30), 0),
         coalesce(sum(o.amt) FILTER (WHERE p_as_of - o.entry_date BETWEEN 31 AND 60), 0),
         coalesce(sum(o.amt) FILTER (WHERE p_as_of - o.entry_date BETWEEN 61 AND 90), 0),
         coalesce(sum(o.amt) FILTER (WHERE p_as_of - o.entry_date > 90), 0),
         coalesce(sum(o.amt) FILTER (WHERE p_as_of - o.entry_date > coalesce(pr.credit_days, 30)), 0)
    FROM open_bills o
    LEFT JOIN public.profiles pr ON pr.id = o.party_id
   GROUP BY o.party_id
  HAVING sum(o.amt) > 0;
$$;

-- 10. Access -------------------------------------------------------------------------------------------------------
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- Only the functions above write entries and lines. The server manages accounts directly.
REVOKE ALL ON public.ledger_accounts, public.ledger_entries, public.ledger_lines, public.supplier_payments
  FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.ledger_accounts TO service_role;
GRANT SELECT ON public.ledger_entries, public.ledger_lines, public.supplier_payments TO service_role;
-- A customer can read their own statement.
GRANT SELECT ON public.ledger_entries, public.ledger_lines TO authenticated;

DROP POLICY IF EXISTS ledger_accounts_service ON public.ledger_accounts;
DROP POLICY IF EXISTS ledger_entries_service ON public.ledger_entries;
DROP POLICY IF EXISTS ledger_lines_service ON public.ledger_lines;
DROP POLICY IF EXISTS supplier_payments_service ON public.supplier_payments;
DROP POLICY IF EXISTS ledger_lines_own ON public.ledger_lines;
DROP POLICY IF EXISTS ledger_entries_own ON public.ledger_entries;
CREATE POLICY ledger_accounts_service ON public.ledger_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ledger_entries_service ON public.ledger_entries FOR SELECT TO service_role USING (true);
CREATE POLICY ledger_lines_service ON public.ledger_lines FOR SELECT TO service_role USING (true);
CREATE POLICY supplier_payments_service ON public.supplier_payments FOR SELECT TO service_role USING (true);
CREATE POLICY ledger_lines_own ON public.ledger_lines FOR SELECT TO authenticated USING (party_id = auth.uid());
CREATE POLICY ledger_entries_own ON public.ledger_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ledger_lines l WHERE l.entry_id = ledger_entries.id AND l.party_id = auth.uid()));

-- Internal: only reachable through the triggers and the functions below.
REVOKE ALL ON FUNCTION public.ledger_fy(date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_num(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_account_id(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_money_account(text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_assert_open(date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_line_json(uuid, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_clean_lines(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_fingerprint(date, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_write_entry(text, text, uuid, date, uuid, text, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_reverse_entry(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync(text, uuid, text, date, uuid, text, jsonb, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_gst_document_lines(uuid, numeric, jsonb, text, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync_invoice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync_credit_note(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync_debit_note(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync_receipt(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_sync_supplier_payment(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_ledger_entry() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_ledger_line() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_ledger_account() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_supplier_payment() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_ledger_entry_balanced() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_invoice() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_credit_note() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_debit_note() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_payment() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_payment_allocations() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ledger_on_supplier_payment() FROM PUBLIC, anon, authenticated, service_role;

-- Called by the server (service role) after it has checked the caller is an admin.
REVOKE ALL ON FUNCTION public.record_supplier_payment(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_payment(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_journal(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_journal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_default_money_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_balances(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_report_lines(date, date, uuid, uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_receivable_ageing(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_payment(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_journal(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_journal(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_default_money_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_balances(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_report_lines(date, date, uuid, uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_receivable_ageing(date) TO service_role;

-- 11. Backfill: post every existing document once, oldest first ------------------------------------------------
-- Cancelled documents are skipped (they would net to zero). Documents already posted are left alone.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT i.id FROM public.invoices i
            WHERE i.status = 'issued'
              AND NOT EXISTS (SELECT 1 FROM public.ledger_entries e WHERE e.voucher_type = 'invoice' AND e.source_id = i.id)
            ORDER BY i.invoice_date, i.created_at LOOP
    PERFORM public.ledger_sync_invoice(r.id);
  END LOOP;

  FOR r IN SELECT c.id FROM public.credit_notes c
            WHERE NOT EXISTS (SELECT 1 FROM public.ledger_entries e WHERE e.voucher_type = 'credit_note' AND e.source_id = c.id)
            ORDER BY c.credit_note_date, c.created_at LOOP
    PERFORM public.ledger_sync_credit_note(r.id);
  END LOOP;

  FOR r IN SELECT d.id FROM public.debit_notes d
            WHERE d.status = 'issued'
              AND NOT EXISTS (SELECT 1 FROM public.ledger_entries e WHERE e.voucher_type = 'debit_note' AND e.source_id = d.id)
            ORDER BY d.debit_note_date, d.created_at LOOP
    PERFORM public.ledger_sync_debit_note(r.id);
  END LOOP;

  FOR r IN SELECT p.id FROM public.payments p
            WHERE p.status = 'received'
              AND NOT EXISTS (SELECT 1 FROM public.ledger_entries e WHERE e.voucher_type = 'receipt' AND e.source_id = p.id)
            ORDER BY p.payment_date, p.created_at LOOP
    PERFORM public.ledger_sync_receipt(r.id);
  END LOOP;
END;
$$;

COMMIT;
