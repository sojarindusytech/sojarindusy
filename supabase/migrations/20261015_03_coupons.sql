-- =============================================================================
-- 20261015_03_coupons.sql
-- Coupon tables, and the order columns that record a discount.
-- =============================================================================
-- WHEN TO RUN: before the app deploy. Additive only: new tables, and new
-- nullable / defaulted columns on orders. Existing orders read as
-- "no discount" (discount_amount = 0) and the current code keeps working.
--
-- Tables
--   coupons              the coupon and all its rules
--   coupon_products      limits a coupon to products        (applies_to = 'products')
--   coupon_categories    limits a coupon to categories      (applies_to = 'categories')
--   coupon_customers     limits a coupon to customers       (customer_scope = 'selected')
--   coupon_redemptions   one row per use; the source of truth for usage counts
--   coupon_attempts      failed Apply attempts, for rate limiting code guessing
--
-- Access: all of these are server-only (service role). Customers never read
-- the coupons table, so codes cannot be listed with the anon key.
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- 1. Coupons -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text          NOT NULL,
  description           text,
  discount_type         text          NOT NULL,
  discount_value        numeric(12, 2) NOT NULL,
  max_discount          numeric(12, 2),
  min_order_value       numeric(12, 2) NOT NULL DEFAULT 0,
  valid_from            timestamptz   NOT NULL DEFAULT now(),
  valid_until           timestamptz,
  max_total_uses        integer,                 -- NULL = unlimited
  max_uses_per_customer integer,                 -- NULL = unlimited, 1 = one-time
  first_order_only      boolean       NOT NULL DEFAULT false,
  can_combine           boolean       NOT NULL DEFAULT false,
  applies_to            text          NOT NULL DEFAULT 'all',
  customer_scope        text          NOT NULL DEFAULT 'all',
  is_active             boolean       NOT NULL DEFAULT true,
  -- Bumped on every update. Checkout passes the version it evaluated; if an
  -- admin edits the coupon in between, the order is refused and re-priced.
  version               integer       NOT NULL DEFAULT 1,
  created_by            uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at            timestamptz,             -- archived (has been used, kept for history)
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT coupons_code_format         CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  CONSTRAINT coupons_discount_type       CHECK (discount_type IN ('percent', 'fixed')),
  CONSTRAINT coupons_discount_value      CHECK (discount_value > 0
                                                AND (discount_type <> 'percent' OR discount_value <= 100)),
  CONSTRAINT coupons_max_discount        CHECK (max_discount IS NULL OR max_discount > 0),
  CONSTRAINT coupons_min_order_value     CHECK (min_order_value >= 0),
  CONSTRAINT coupons_validity_window     CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT coupons_max_total_uses      CHECK (max_total_uses IS NULL OR max_total_uses > 0),
  CONSTRAINT coupons_max_uses_customer   CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer > 0),
  CONSTRAINT coupons_applies_to          CHECK (applies_to IN ('all', 'products', 'categories')),
  CONSTRAINT coupons_customer_scope      CHECK (customer_scope IN ('all', 'selected'))
);

-- A code is unique among live coupons; archiving a coupon frees its code.
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_live_key
  ON public.coupons (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS coupons_created_at_idx ON public.coupons (created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_coupons_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version    := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coupons_touch ON public.coupons;
CREATE TRIGGER coupons_touch
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.tg_coupons_touch();

-- 2. Eligibility lists -----------------------------------------------------------------------
-- Deleting a product, category or customer removes it from the list. A coupon
-- left with an empty list matches nothing, so it fails closed.
CREATE TABLE IF NOT EXISTS public.coupon_products (
  coupon_id  uuid NOT NULL REFERENCES public.coupons(id)  ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT coupon_products_pkey PRIMARY KEY (coupon_id, product_id)
);
CREATE INDEX IF NOT EXISTS coupon_products_product_idx ON public.coupon_products (product_id);

CREATE TABLE IF NOT EXISTS public.coupon_categories (
  coupon_id   uuid NOT NULL REFERENCES public.coupons(id)    ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  CONSTRAINT coupon_categories_pkey PRIMARY KEY (coupon_id, category_id)
);
CREATE INDEX IF NOT EXISTS coupon_categories_category_idx ON public.coupon_categories (category_id);

CREATE TABLE IF NOT EXISTS public.coupon_customers (
  coupon_id uuid NOT NULL REFERENCES public.coupons(id)  ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT coupon_customers_pkey PRIMARY KEY (coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS coupon_customers_user_idx ON public.coupon_customers (user_id);

-- 3. Redemptions -------------------------------------------------------------------------------
-- status: applied  = counted (order placed)
--         reserved = counted until expires_at (for a future online-payment step)
--         released = not counted (order cancelled, or payment failed / timed out)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       uuid          NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  order_id        uuid          NOT NULL REFERENCES public.orders(id)  ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES public.profiles(id),
  coupon_code     text          NOT NULL,
  discount_amount numeric(12, 2) NOT NULL,
  status          text          NOT NULL DEFAULT 'applied',
  expires_at      timestamptz,
  released_at     timestamptz,
  release_reason  text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT coupon_redemptions_one_per_order UNIQUE (coupon_id, order_id),
  CONSTRAINT coupon_redemptions_discount      CHECK (discount_amount >= 0),
  CONSTRAINT coupon_redemptions_status        CHECK (status IN ('reserved', 'applied', 'released')),
  CONSTRAINT coupon_redemptions_reserved_exp  CHECK (status <> 'reserved' OR expires_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_status_idx
  ON public.coupon_redemptions (coupon_id, status);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_coupon_idx
  ON public.coupon_redemptions (user_id, coupon_id, status);
CREATE INDEX IF NOT EXISTS coupon_redemptions_order_idx
  ON public.coupon_redemptions (order_id);

-- 4. Failed attempts (rate limiting) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupon_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coupon_attempts_user_recent_idx
  ON public.coupon_attempts (user_id, created_at DESC);

-- 5. Orders: what was discounted, how GST was charged, and a retry-safe checkout key -------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code     text,
  ADD COLUMN IF NOT EXISTS coupon_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS tax_snapshot    jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_discount_amount_non_negative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_amount_non_negative CHECK (discount_amount >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_key
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.discount_amount IS 'Coupon discount, taken off the subtotal before GST.';
COMMENT ON COLUMN public.orders.coupon_snapshot IS 'The coupon rules as they were when the order was placed. Never updated.';
COMMENT ON COLUMN public.orders.tax_snapshot IS 'GST basis at order time (billing on/off, place of supply, CGST/SGST/IGST split and totals). The invoice reproduces it. Never updated.';
COMMENT ON COLUMN public.orders.idempotency_key IS 'One per checkout attempt; a retried submit returns the same order.';

-- 6. Server-only access ---------------------------------------------------------------------
ALTER TABLE public.coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_attempts    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coupons, public.coupon_products, public.coupon_categories,
              public.coupon_customers, public.coupon_redemptions, public.coupon_attempts
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.coupons, public.coupon_products, public.coupon_categories,
     public.coupon_customers, public.coupon_redemptions, public.coupon_attempts
  TO service_role;

COMMIT;
