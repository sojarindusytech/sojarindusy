-- Migration: Create Products, Product Variants (with dynamic specs jsonb), Tags, and Product-Tag Junction Tables
-- Date: 2026-08-20

-- 1. Create products table (Product Family / Parent)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of { url: string, title: string }
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- 2. Create product_variants table (SKU Rows with dynamic specifications JSONB for flexible tool types)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  diameter numeric,
  flute_length numeric,
  overall_length numeric,
  shank_diameter numeric,
  list_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb, -- Dynamic attributes (e.g. Corner Radius, Helix Angle, Point Angle, Tolerance, etc.)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);

-- 3. Create tags table (e.g. Hardness HRC 55, HRC 45, HRC 65, Material Grade, Coating)
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'hardness'::text, -- e.g. 'hardness', 'material', 'coating', 'general'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_type ON public.tags(type);

-- 4. Create product_tags junction table
CREATE TABLE IF NOT EXISTS public.product_tags (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON public.product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON public.product_tags(tag_id);

-- 5. Row Level Security Policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access to product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Allow public read access to tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access to product_tags" ON public.product_tags FOR SELECT USING (true);

-- Admin full access
CREATE POLICY "Allow admin access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin access to product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin access to tags" ON public.tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin access to product_tags" ON public.product_tags FOR ALL USING (true) WITH CHECK (true);
