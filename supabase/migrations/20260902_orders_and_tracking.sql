-- ==============================================================================
-- MIGRATION: Orders Enhancement & Logistics Tracking
-- Date: 2026-09-02
--
-- Description:
-- Adds subtotal, GST calculation, logistics tracking (courier, AWB, tracking URL),
-- and status transition timestamps to public.orders table.
-- ==============================================================================

-- 1. Extend orders table with logistics and pricing columns
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_partner TEXT,
  ADD COLUMN IF NOT EXISTS awb_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_details JSONB DEFAULT '{}'::jsonb;

-- 2. Update status check constraint if needed
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
