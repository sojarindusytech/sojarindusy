-- ==============================================================================
-- Migration: Rename Tags to Attributes, Remove Type Column, and Add Restrict FK
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

DO $$ 
BEGIN
  -- 1. Rename 'tags' table to 'attributes' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tags'
  ) THEN
    ALTER TABLE public.tags RENAME TO attributes;
  END IF;

  -- 2. Rename 'product_tags' table to 'product_attributes' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'product_tags'
  ) THEN
    ALTER TABLE public.product_tags RENAME TO product_attributes;
  END IF;

  -- 3. Rename 'tag_id' column to 'attribute_id' in 'product_attributes' if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_attributes' AND column_name = 'tag_id'
  ) THEN
    ALTER TABLE public.product_attributes RENAME COLUMN tag_id TO attribute_id;
  END IF;

  -- 4. Drop 'type' column from 'attributes' table if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attributes' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.attributes DROP COLUMN type;
  END IF;

  -- 5. Recreate/Update foreign key constraint to RESTRICT deletion when products exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'product_attributes' AND constraint_name = 'product_tags_tag_id_fkey'
  ) THEN
    ALTER TABLE public.product_attributes DROP CONSTRAINT product_tags_tag_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'product_attributes' AND constraint_name = 'product_attributes_attribute_id_fkey'
  ) THEN
    ALTER TABLE public.product_attributes DROP CONSTRAINT product_attributes_attribute_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'product_attributes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'attributes'
  ) THEN
    ALTER TABLE public.product_attributes
      ADD CONSTRAINT product_attributes_attribute_id_fkey
      FOREIGN KEY (attribute_id) REFERENCES public.attributes(id)
      ON DELETE RESTRICT;
  END IF;

  -- 6. Recreate foreign key on product_categories to RESTRICT deletion when products are assigned
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'product_categories' AND constraint_name = 'product_categories_category_id_fkey'
  ) THEN
    ALTER TABLE public.product_categories DROP CONSTRAINT product_categories_category_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'product_categories'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT product_categories_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id)
      ON DELETE RESTRICT;
  END IF;

END $$;
