-- ==============================================================================
-- MIGRATION: Add privacy_accepted column to contact_submissions
-- Date: 2026-09-21
--
-- Description:
-- Records user explicit consent to Privacy Policy upon submitting contact inquiry.
-- ==============================================================================

-- 1. Add privacy_accepted column to contact_submissions if it does not already exist
ALTER TABLE public.contact_submissions 
ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN NOT NULL DEFAULT true;

-- 2. Audit comment
COMMENT ON COLUMN public.contact_submissions.privacy_accepted IS 'Indicates whether the user explicitly consented to the Privacy Policy when submitting their message';
