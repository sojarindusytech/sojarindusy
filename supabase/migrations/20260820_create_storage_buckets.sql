-- Migration: Create Supabase Storage Bucket for Category & Product Images
-- Date: 2026-08-20

-- 1. Create 'category-images' public bucket in storage.buckets if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'category-images',
  'category-images',
  true,
  5242880, -- 5 MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Policies for 'category-images' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Read Access for Category Images'
  ) THEN
    CREATE POLICY "Public Read Access for Category Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'category-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admin Upload Access for Category Images'
  ) THEN
    CREATE POLICY "Admin Upload Access for Category Images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'category-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admin Update Access for Category Images'
  ) THEN
    CREATE POLICY "Admin Update Access for Category Images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'category-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admin Delete Access for Category Images'
  ) THEN
    CREATE POLICY "Admin Delete Access for Category Images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'category-images');
  END IF;
END $$;
