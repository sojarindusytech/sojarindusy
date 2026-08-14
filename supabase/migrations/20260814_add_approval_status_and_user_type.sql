-- Migration: Add approval_status and user_type for Customer Onboarding & Offline Management
-- Created: 2026-08-14

-- 1. Add approval_status and user_type columns to public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' 
  CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'platform_user' 
  CHECK (user_type IN ('platform_user', 'offline_user')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30;

-- 2. Update existing platform admin and existing profiles to 'approved'
UPDATE public.profiles 
SET approval_status = 'approved', user_type = 'platform_user' 
WHERE role = 'platform_owner' OR approval_status IS NULL;

-- 3. Indexes for fast filtering in Admin Customers Module
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_company_name ON public.profiles(company_name);
CREATE INDEX IF NOT EXISTS idx_profiles_gstin ON public.profiles(gstin);

-- 4. Enable platform owner to view and manage all profiles
DROP POLICY IF EXISTS "Platform owner can view and manage all profiles" ON public.profiles;
CREATE POLICY "Platform owner can view and manage all profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_owner'
    )
  );
