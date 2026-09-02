-- Migration: Rename tags and product_tags to attributes and product_attributes
-- Enforce RESTRICT constraint on attribute deletion if linked to products

DO $$ 
BEGIN
  -- 1. Rename 'tags' table to 'attributes' if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags') THEN
    ALTER TABLE public.tags RENAME TO attributes;
  END IF;

  -- 2. Rename 'product_tags' table to 'product_attributes' if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_tags') THEN
    ALTER TABLE public.product_tags RENAME TO product_attributes;
  END IF;

  -- 3. Rename 'tag_id' column in 'product_attributes' to 'attribute_id' if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_attributes' AND column_name = 'tag_id'
  ) THEN
    ALTER TABLE public.product_attributes RENAME COLUMN tag_id TO attribute_id;
  END IF;

  -- 4. Recreate/Update foreign key constraints if needed with RESTRICT
  -- Drop existing constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'product_attributes' AND constraint_name = 'product_tags_tag_id_fkey'
  ) THEN
    ALTER TABLE public.product_attributes DROP CONSTRAINT product_tags_tag_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'product_attributes' AND constraint_name = 'product_attributes_attribute_id_fkey'
  ) THEN
    ALTER TABLE public.product_attributes
      ADD CONSTRAINT product_attributes_attribute_id_fkey
      FOREIGN KEY (attribute_id) REFERENCES public.attributes(id)
      ON DELETE RESTRICT;
  END IF;

END $$;
