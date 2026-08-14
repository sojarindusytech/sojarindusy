-- ===================================================================
-- SOJAR INDUSY - PLATFORM ADMIN SEED MIGRATION
-- Admin Credentials:
-- Email: admin@sojarindusy.com
-- Password: Qtpl@12345
-- Role: platform_owner
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_uid UUID := gen_random_uuid();
  encrypted_pw TEXT;
BEGIN
  -- Generate bcrypt hash for password Qtpl@12345
  encrypted_pw := crypt('Qtpl@12345', gen_salt('bf'));

  -- Check if user already exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@sojarindusy.com') THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@sojarindusy.com',
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"platform_owner","first_name":"Super","last_name":"Admin","title":"Mr","company_name":"Sojar Indusy Tech","department":"Executive Management","designation":"Platform Administrator","mobile":"9876543210","city":"Pune","state":"Maharashtra","pincode":"411001","company_address":"Sojar Indusy Corporate Headquarters"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (
      id,
      role,
      title,
      first_name,
      last_name,
      department,
      designation,
      mobile,
      landline,
      email,
      company_name,
      company_address,
      additional_address,
      gstin,
      city,
      state,
      pincode,
      created_at,
      updated_at
    )
    VALUES (
      admin_uid,
      'platform_owner',
      'Mr',
      'Super',
      'Admin',
      'Executive Management',
      'Platform Administrator',
      '9876543210',
      '020-12345678',
      'admin@sojarindusy.com',
      'Sojar Indusy Tech',
      'Sojar Indusy Corporate Headquarters, Phase 1 MIDC',
      'Corporate Tower, Suite 500',
      '27AAAAA9999A1Z9',
      'Pune',
      'Maharashtra',
      '411001',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'platform_owner',
      updated_at = NOW();

    RAISE NOTICE 'Platform admin admin@sojarindusy.com created successfully with UID %', admin_uid;
  ELSE
    -- If already exists in auth.users, update password and ensure profile is platform_owner
    UPDATE auth.users
    SET encrypted_password = encrypted_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE email = 'admin@sojarindusy.com';

    UPDATE public.profiles
    SET role = 'platform_owner',
        updated_at = NOW()
    WHERE email = 'admin@sojarindusy.com';

    RAISE NOTICE 'Platform admin admin@sojarindusy.com updated successfully';
  END IF;
END $$;
