-- ==============================================================================
-- MIGRATION: Simplify User Roles and Customer Channels
-- Date: 2026-09-02
--
-- Description:
-- Standardizes user roles to 'admin' and 'customer', and customer channels to 'online' and 'offline'.
-- ==============================================================================

-- 1. First, relax / update constraints so new values ('admin', 'online', 'offline') are accepted
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'customer', 'platform_owner'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- 2. Add 'channel' column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'channel'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN channel TEXT DEFAULT 'online';
  END IF;
END $$;

-- 3. Now safely update existing data
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'platform_owner';

-- Populate channel and user_type values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_type'
  ) THEN
    UPDATE public.profiles
    SET channel = CASE
      WHEN user_type = 'offline_user' OR user_type = 'offline' THEN 'offline'
      ELSE 'online'
    END
    WHERE channel IS NULL OR channel = 'online';

    -- Update user_type for backward compatibility
    UPDATE public.profiles
    SET user_type = 'online'
    WHERE user_type = 'platform_user';

    UPDATE public.profiles
    SET user_type = 'offline'
    WHERE user_type = 'offline_user';
  END IF;
END $$;

-- 4. Apply final check constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_channel_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_channel_check
  CHECK (channel IN ('online', 'offline'));

-- 5. Helper function for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'platform_owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
