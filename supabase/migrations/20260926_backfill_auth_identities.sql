-- Repair password sign-in, and seed the manufacturer account.
--
-- Two defects, both caused by seeding accounts with raw INSERT INTO auth.users
-- (see 20260814_create_platform_admin.sql):
--
--   1. NULL token columns. GoTrue scans these into non-nullable Go strings, so
--      one bad row makes the whole table unreadable — listUsers and
--      signInWithPassword fail with "Database error finding user(s)" even for
--      accounts that are themselves valid. The expected empty value is ''.
--
--   2. No auth.identities row. GoTrue resolves a password login through
--      auth.identities (provider='email'); without it, sign-in returns
--      "Invalid login credentials" whatever the password is. The symptom in
--      the auth.users view is an empty "providers": [].
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Replace NULL token columns with empty strings
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  col   text;
  cols  text[] := ARRAY[
    'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change_token_current', 'email_change',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ];
  fixed integer;
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = col
    ) THEN
      EXECUTE format('UPDATE auth.users SET %I = %L WHERE %I IS NULL', col, '', col);
      GET DIAGNOSTICS fixed = ROW_COUNT;
      IF fixed > 0 THEN
        RAISE NOTICE 'auth.users.%: fixed % NULL(s)', col, fixed;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Create the manufacturer account (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_email text := 'manufacturer@sojarsolutions.com';
  target_pw    text := 'Qtpl@12345';
  uid          uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = target_email;

  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      target_email, crypt(target_pw, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', 'Sojar',
        'last_name', 'Manufacturing Partner',
        'company_name', 'Sojar Precision Manufacturing Ltd'
      ),
      '', '', '', '', ''
    );
    RAISE NOTICE 'Created auth user % (%)', target_email, uid;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(target_pw, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = uid;
    RAISE NOTICE 'Reset password for existing user % (%)', target_email, uid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill the missing email identities for ALL affected accounts
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_provider_id boolean;
  u               RECORD;
  inserted        integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) INTO has_provider_id;

  FOR u IN
    SELECT au.id, au.email FROM auth.users au
    WHERE au.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = au.id AND i.provider = 'email'
      )
  LOOP
    BEGIN
      IF has_provider_id THEN
        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
        VALUES (gen_random_uuid(), u.id,
          jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
          'email', u.id::text, now(), now());
      ELSE
        INSERT INTO auth.identities (id, user_id, identity_data, provider, created_at, updated_at)
        VALUES (gen_random_uuid(), u.id,
          jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now());
      END IF;
      inserted := inserted + 1;
      RAISE NOTICE 'Created email identity for %', u.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Identity backfill skipped for %: %', u.email, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Backfilled % identities', inserted;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Profile rows for both manufacturer accounts
--    The role is authoritative here, never in raw_user_meta_data.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  e text;
BEGIN
  FOREACH e IN ARRAY ARRAY['manufacturer@sojarsolutions.com', 'manufacturer@sojarindusy.com'] LOOP
    INSERT INTO public.profiles (
      id, email, role, approval_status,
      title, first_name, last_name, department, designation, mobile,
      company_name, company_address, city, state, pincode
    )
    SELECT u.id, u.email, 'manufacturer', 'approved',
           'Mr', 'Sojar', 'Manufacturing Partner', 'Production', 'Manufacturing Partner', '9876543211',
           'Sojar Precision Manufacturing Ltd', 'Plot 14, MIDC Industrial Estate', 'Pune', 'Maharashtra', '411019'
    FROM auth.users u WHERE u.email = e
    ON CONFLICT (id) DO UPDATE
      SET role = 'manufacturer', approval_status = 'approved', updated_at = now();
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
SELECT u.email,
       u.encrypted_password IS NOT NULL AS has_password,
       u.email_confirmed_at IS NOT NULL AS confirmed,
       i.provider,
       p.role,
       p.approval_status
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.email;
