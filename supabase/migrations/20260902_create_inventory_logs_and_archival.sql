-- ==============================================================================
-- Migration: Create Inventory Logs Table & Variant Archival Flags
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Add archival columns to product_variants
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- 2. Create inventory_logs table for immutable stock audit tracking
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku_code text NOT NULL,
  product_title text NOT NULL,
  movement_type text NOT NULL,
  quantity_delta integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  reference_id text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Create indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_inventory_logs_variant_id ON public.inventory_logs(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON public.inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_sku_code ON public.inventory_logs(sku_code);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON public.inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_archived ON public.product_variants(is_archived);

-- 4. Enable RLS and add basic security policies
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to read inventory logs"
  ON public.inventory_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to inventory logs"
  ON public.inventory_logs
  FOR ALL
  TO service_role
  USING (true);
