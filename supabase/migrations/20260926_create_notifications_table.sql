-- Migration: 20260926_create_notifications_table.sql
-- Create notifications table for all user roles (admin, customer, manufacturer)

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text CHECK (role = ANY (ARRAY['admin'::text, 'customer'::text, 'platform_owner'::text, 'manufacturer'::text])),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notifications(role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role full access on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update read status on own notifications" ON public.notifications;

-- Policies
CREATE POLICY "Service role full access on notifications" 
  ON public.notifications FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Users can read own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    OR (
      role IS NOT NULL 
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
    OR (
      role = 'admin' 
      AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'platform_owner')
      )
    )
  );

CREATE POLICY "Users can update read status on own notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    OR (
      role IS NOT NULL 
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
    OR (
      role = 'admin' 
      AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'platform_owner')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR (
      role IS NOT NULL 
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
    OR (
      role = 'admin' 
      AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'platform_owner')
      )
    )
  );
