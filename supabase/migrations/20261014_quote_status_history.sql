-- Migration: 20261014_quote_status_history.sql
-- Every quotation status change is recorded in its own table. quotes.status stays as the
-- current status (for filtering); this table is the timeline behind it.
-- Requires 20261013_quotes.sql.

CREATE TABLE IF NOT EXISTS public.quote_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL CHECK (to_status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])),
  notes text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_status_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_quote_status_history_quote ON public.quote_status_history(quote_id, changed_at DESC);

ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on quote_status_history" ON public.quote_status_history;
CREATE POLICY "Service role full access on quote_status_history"
  ON public.quote_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Quotes that already exist get one starting row so their timeline isn't empty.
INSERT INTO public.quote_status_history (quote_id, from_status, to_status, notes, changed_by, changed_at)
SELECT q.id, NULL, q.status, 'Quotation created', q.created_by, q.created_at
FROM public.quotes q
WHERE NOT EXISTS (SELECT 1 FROM public.quote_status_history h WHERE h.quote_id = q.id);
