-- ===================================================================
-- SOJAR INDUSY - SUPABASE DATABASE SCHEMA
-- Execute this SQL script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/egtimyfpruzbmscnglxs/sql
-- ===================================================================

-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('platform_owner', 'customer')) NOT NULL DEFAULT 'customer',
  
  -- Personal / Professional Details
  title TEXT CHECK (title IN ('Mr', 'Mrs', 'Miss', 'Ms')) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  mobile TEXT NOT NULL,
  landline TEXT,
  email TEXT NOT NULL,
  
  -- Company Details
  company_name TEXT NOT NULL,
  company_address TEXT NOT NULL,
  additional_address TEXT,
  gstin TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Orders Table (Ecommerce Order Tracking)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')) NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(12, 2) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipping_address TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Helper Function to Check If User is Platform Owner
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Profiles RLS Policies
-- Users can read their own profile OR platform owners can read all profiles
DROP POLICY IF EXISTS "Users can read own profile or admin can read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admin can read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_platform_owner());

-- Users can insert their own profile upon signup
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile OR platform owners can update any profile
DROP POLICY IF EXISTS "Users can update own profile or admin can update any" ON public.profiles;
CREATE POLICY "Users can update own profile or admin can update any"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_platform_owner());

-- 6. Orders RLS Policies
-- Users can view their own orders OR platform owners can view all orders
DROP POLICY IF EXISTS "Users can view own orders or admin view all" ON public.orders;
CREATE POLICY "Users can view own orders or admin view all"
ON public.orders FOR SELECT
USING (auth.uid() = user_id OR public.is_platform_owner());

-- Platform owners or customer can insert orders
DROP POLICY IF EXISTS "Users or admin can insert orders" ON public.orders;
CREATE POLICY "Users or admin can insert orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_platform_owner());

-- Platform owners can update order status
DROP POLICY IF EXISTS "Admin can update orders" ON public.orders;
CREATE POLICY "Admin can update orders"
ON public.orders FOR UPDATE
USING (public.is_platform_owner());

-- 7. Trigger to automatically create profile on Auth Signup (Optional fallback)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    pincode
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    COALESCE(new.raw_user_meta_data->>'title', 'Mr'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'department', ''),
    COALESCE(new.raw_user_meta_data->>'designation', ''),
    COALESCE(new.raw_user_meta_data->>'mobile', ''),
    new.raw_user_meta_data->>'landline',
    new.email,
    COALESCE(new.raw_user_meta_data->>'company_name', ''),
    COALESCE(new.raw_user_meta_data->>'company_address', ''),
    new.raw_user_meta_data->>'additional_address',
    new.raw_user_meta_data->>'gstin',
    COALESCE(new.raw_user_meta_data->>'city', ''),
    COALESCE(new.raw_user_meta_data->>'state', ''),
    COALESCE(new.raw_user_meta_data->>'pincode', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
