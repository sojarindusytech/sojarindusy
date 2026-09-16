-- ==============================================================================
-- MIGRATION: Create Contact Submissions Table
-- Date: 2026-09-16
--
-- Description:
-- Creates the public.contact_submissions table to capture customer inquiries 
-- from the storefront contact form with full RLS policies and audit timestamps.
-- ==============================================================================

-- 1. Create contact_submissions table
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast administrative querying & filtering
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status 
    ON public.contact_submissions(status);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at 
    ON public.contact_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email 
    ON public.contact_submissions(email);

-- 3. Enable Row Level Security
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Anyone (anonymous visitors & authenticated users) can submit an inquiry
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form" 
    ON public.contact_submissions
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

-- 5. RLS Policy: Only admins and platform owners can view submissions
DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions" 
    ON public.contact_submissions
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'platform_owner')
        )
    );

-- 6. RLS Policy: Only admins and platform owners can update status/notes
DROP POLICY IF EXISTS "Admins can update contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can update contact submissions" 
    ON public.contact_submissions
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'platform_owner')
        )
    );

-- 7. RLS Policy: Only admins and platform owners can delete submissions
DROP POLICY IF EXISTS "Admins can delete contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can delete contact submissions" 
    ON public.contact_submissions
    FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'platform_owner')
        )
    );
