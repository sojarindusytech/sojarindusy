-- Migration: Remove 'type' column from attributes and tags tables
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attributes' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.attributes DROP COLUMN type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.tags DROP COLUMN type;
  END IF;
END $$;
