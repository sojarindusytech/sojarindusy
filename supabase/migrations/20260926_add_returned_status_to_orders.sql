-- Migration: 20260926_add_returned_status_to_orders.sql
-- Support full order lifecycle: returns, manual dispatch, and delivery

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'returned'::text, 'cancelled'::text]));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_reason text;
