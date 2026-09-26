-- Add min_quantity column to product_variants
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.product_variants.min_quantity IS 'Minimum order units required for this SKU';
   