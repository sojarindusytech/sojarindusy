-- Migration: 20261022_auth_hardening.sql
-- 1. One profile per email address (case-insensitive).
-- 2. A profile follows its auth user when that user is deleted.

-- 1. Skipped with a warning when duplicates already exist, so the migration never fails halfway:
--    list them with
--      SELECT lower(email), count(*) FROM public.profiles GROUP BY 1 HAVING count(*) > 1;
--    fix or merge those rows, then re-run this file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE WARNING 'profiles_email_lower_key NOT created: duplicate emails exist in public.profiles';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles (lower(email));
  END IF;
END $$;

-- 2. Rows in orders, invoices, payments, ... still reference profiles without CASCADE, so a customer
--    who has any history cannot be deleted by accident: the delete is refused. Only a customer with no
--    history (for example a signup that never completed) disappears together with its login.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
