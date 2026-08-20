-- Migration: Ensure image_url column exists on categories table
-- Date: 2026-08-20

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS image_url text;
