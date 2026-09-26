-- Migration: 20260926_create_purchase_orders_and_manufacturer_role.sql
-- 1. Update profiles role check to include 'manufacturer'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'customer'::text, 'platform_owner'::text, 'manufacturer'::text]));

-- 2. Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  product_title text NOT NULL,
  min_quantity integer NOT NULL DEFAULT 0,
  actual_quantity integer NOT NULL DEFAULT 0,
  order_quantity integer NOT NULL DEFAULT 0,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Placed' CHECK (status = ANY (ARRAY['Placed'::text, 'Dispatched / In Transit'::text, 'Received'::text])),
  manufacturer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  placed_at timestamp with time zone NOT NULL DEFAULT now(),
  dispatched_at timestamp with time zone,
  received_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id)
);

-- 3. Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_purchase_orders_variant_id ON public.purchase_orders(variant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Service role full access on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Service role full access on purchase_orders" 
  ON public.purchase_orders 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Admin full access on purchase_orders" 
  ON public.purchase_orders 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'platform_owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'platform_owner')
    )
  );

DROP POLICY IF EXISTS "Manufacturer read access on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Manufacturer read access on purchase_orders" 
  ON public.purchase_orders 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('manufacturer', 'admin', 'platform_owner')
    )
  );
