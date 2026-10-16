-- =============================================================================
-- 20261020_document_terms.sql
-- Terms & conditions per document type. sales_settings.terms stays the INVOICE terms; quotations and
-- payment receipts get their own. A blank quotation terms field falls back to the invoice terms, so
-- nothing changes until an admin writes new ones.
-- =============================================================================
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS quote_terms text,
  ADD COLUMN IF NOT EXISTS receipt_terms text;

COMMENT ON COLUMN public.sales_settings.terms IS 'Terms & conditions printed on invoices (and on quotations until quote_terms is set).';
COMMENT ON COLUMN public.sales_settings.quote_terms IS 'Terms & conditions printed on quotations. NULL = use terms.';
COMMENT ON COLUMN public.sales_settings.receipt_terms IS 'Note printed on payment receipts. NULL = none.';
