-- ==============================================================================
-- Migration: 20261026_contact_hardening
--
-- 1. The storefront contact form inserts through a server action (service role), so
--    anonymous/authenticated clients never need to write this table directly. The old
--    "Anyone can submit" policy let anyone holding the public anon key bypass every
--    validation (any size, any status, any admin_notes) and flood the inbox.
-- 2. Consent is recorded only when given: privacy_accepted no longer defaults to true.
-- 3. Size limits in the database. NOT VALID: existing rows are not re-checked, new and
--    updated rows are.
-- ==============================================================================

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;

ALTER TABLE public.contact_submissions ALTER COLUMN privacy_accepted SET DEFAULT false;

ALTER TABLE public.contact_submissions DROP CONSTRAINT IF EXISTS contact_submissions_lengths;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_lengths CHECK (
        char_length(full_name) BETWEEN 1 AND 100
    AND char_length(email) BETWEEN 3 AND 254
    AND (mobile IS NULL OR char_length(mobile) <= 20)
    AND char_length(message) BETWEEN 1 AND 2000
    AND (admin_notes IS NULL OR char_length(admin_notes) <= 5000)
  ) NOT VALID;

-- Rate-limit lookups: recent submissions by email (stored lower-cased by the server action).
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_created
  ON public.contact_submissions (email, created_at DESC);
