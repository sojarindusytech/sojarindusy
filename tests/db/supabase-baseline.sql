-- Minimal stand-in for a Supabase project, used only by tests/db/*.test.ts:
-- the API roles, auth.uid(), the storage schema, Supabase's default grants,
-- and the hand-made tables (profiles, orders) that no repo migration creates.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;

-- Supabase grants everything in public to the API roles by default.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'customer',
  title text NOT NULL DEFAULT 'Mr',
  first_name text NOT NULL DEFAULT '-',
  last_name text NOT NULL DEFAULT '-',
  department text NOT NULL DEFAULT '-',
  designation text NOT NULL DEFAULT '-',
  mobile text NOT NULL DEFAULT '-',
  landline text,
  email text NOT NULL DEFAULT '-',
  company_name text NOT NULL DEFAULT '-',
  company_address text NOT NULL DEFAULT '-',
  additional_address text,
  gstin text,
  city text NOT NULL DEFAULT '-',
  state text NOT NULL DEFAULT '-',
  pincode text NOT NULL DEFAULT '-',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approval_status text NOT NULL DEFAULT 'pending',
  channel text NOT NULL DEFAULT 'online',
  user_type text DEFAULT 'online',
  notes text,
  credit_limit numeric DEFAULT 0,
  credit_days integer DEFAULT 30
);

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_address text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Simulate the unknown hand-made state: RLS off, wide open.
GRANT ALL ON public.profiles, public.orders TO anon, authenticated, service_role;

-- rfqs was created by hand in the live project (never migrated). The upstream
-- quotes migration (20261013) references it, so it must exist before that runs.
CREATE TABLE public.rfqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name text,
  contact_person text,
  email text,
  mobile text,
  item_name text NOT NULL,
  quantity text NOT NULL,
  required_by_date date,
  specifications text,
  drawing_url text,
  status text NOT NULL DEFAULT 'pending',
  quoted_amount numeric,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT ALL ON public.rfqs TO anon, authenticated, service_role;
