-- Migration: Create Free-Form Nested Categories and Product-Category Junction Tables
-- Date: 2026-08-17

-- 1. Create categories table supporting parent-child hierarchy
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT, -- Prevent deletion if child categories exist
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast parent-child lookup & sorting
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order);

-- 2. Create product_categories junction table for multi-category assignment
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON public.product_categories(category_id);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated users to read active categories
CREATE POLICY "Allow read access to categories" ON public.categories
  FOR SELECT USING (true);

-- Allow service role / admin users full access to categories
CREATE POLICY "Allow service role full access to categories" ON public.categories
  FOR ALL USING (true) WITH CHECK (true);

-- Allow read access to product_categories
CREATE POLICY "Allow read access to product_categories" ON public.product_categories
  FOR SELECT USING (true);

-- Allow service role full access to product_categories
CREATE POLICY "Allow service role full access to product_categories" ON public.product_categories
  FOR ALL USING (true) WITH CHECK (true);
