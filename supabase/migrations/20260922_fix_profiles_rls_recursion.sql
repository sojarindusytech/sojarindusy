-- Fix infinite recursion in profiles RLS + guarantee a profile row per auth user.
--
-- The previous policy queried public.profiles from inside a policy ON
-- public.profiles, so every read raised:
--   "infinite recursion detected in policy for relation profiles"
-- which is why the application routed all reads through the Service Role key.

-- 1. Role lookup that does not re-enter RLS.
-- SECURITY DEFINER runs as the owner, so the SELECT inside is not subject to
-- the policies on public.profiles and cannot recurse.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_approval_status()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT approval_status FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_approval_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_approval_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('admin', 'platform_owner');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Replace the recursive policies.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform owner can view and manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Self-service updates must not be able to grant privileges. The comparisons
-- go through SECURITY DEFINER functions rather than a subquery on
-- public.profiles, which would recurse into this same policy.
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_user_role()
    AND approval_status = public.current_user_approval_status()
  );

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Guarantee a profile row for every auth user.
-- Without this, a failed application-side insert left an auth account with no
-- profile, and the app fell back to defaults to decide role and approval.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, role, approval_status,
    title, first_name, last_name, department, designation, mobile,
    company_name, company_address, city, state, pincode
  )
  VALUES (
    NEW.id,
    NEW.email,
    'customer',                                   -- never from user_metadata
    'pending',                                    -- deny by default
    COALESCE(NEW.raw_user_meta_data ->> 'title', 'Mr'),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'designation', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'mobile', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'company_address', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'city', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'state', '-'),
    COALESCE(NEW.raw_user_meta_data ->> 'pincode', '-')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Defence in depth only. The application-side insert in signUpUser is the
  -- primary path and rolls the auth user back on failure, so a schema
  -- mismatch here must not abort account creation.
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill: any existing auth user missing a profile defaults to pending.
-- Reuses the trigger function's column list so it cannot fail on a NOT NULL
-- column that the short form would have omitted.
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT au.* FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    BEGIN
      INSERT INTO public.profiles (
        id, email, role, approval_status,
        title, first_name, last_name, department, designation, mobile,
        company_name, company_address, city, state, pincode
      )
      VALUES (
        u.id, u.email, 'customer', 'pending',
        COALESCE(u.raw_user_meta_data ->> 'title', 'Mr'),
        COALESCE(u.raw_user_meta_data ->> 'first_name', split_part(u.email, '@', 1)),
        COALESCE(u.raw_user_meta_data ->> 'last_name', ''),
        COALESCE(u.raw_user_meta_data ->> 'department', '-'),
        COALESCE(u.raw_user_meta_data ->> 'designation', '-'),
        COALESCE(u.raw_user_meta_data ->> 'mobile', '-'),
        COALESCE(u.raw_user_meta_data ->> 'company_name', '-'),
        COALESCE(u.raw_user_meta_data ->> 'company_address', '-'),
        COALESCE(u.raw_user_meta_data ->> 'city', '-'),
        COALESCE(u.raw_user_meta_data ->> 'state', '-'),
        COALESCE(u.raw_user_meta_data ->> 'pincode', '-')
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Backfill skipped for %: %', u.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5. Re-assert least privilege on any profile whose role came from metadata.
-- Admin accounts must be promoted deliberately, never by self-registration.
UPDATE public.profiles
SET role = 'customer'
WHERE role NOT IN ('customer', 'admin', 'platform_owner');
