-- Credit note terms are captured by issue_credit_note's existing seller snapshot.
-- Existing credit_notes snapshots stay unchanged.
ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS credit_note_terms text DEFAULT E'This credit note relates to the original invoice referenced above and records an adjustment for the reason stated.\n\nAny refund or adjustment against outstanding dues will be recorded separately.';

COMMENT ON COLUMN public.sales_settings.credit_note_terms IS
  'Additional credit note terms, snapshotted on issue. NULL or blank = no additional terms.';
