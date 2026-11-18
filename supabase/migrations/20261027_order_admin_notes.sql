-- ==============================================================================
-- Migration: 20261027_order_admin_notes
--
-- Internal dispatch / status notes for an order. They used to be written into
-- orders.notes, which is the customer's own checkout note and is shown to the
-- customer: an admin edit overwrote the customer's instructions and published
-- internal remarks. They live in their own table now. Customers can read their
-- orders rows (RLS), so the notes must not be a column there: this table has RLS
-- on and no policies, so only the service role (server actions) can reach it.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.order_admin_notes (
  order_id   uuid        PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  notes      text        NOT NULL CHECK (char_length(notes) <= 5000),
  updated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_admin_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_admin_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_admin_notes TO service_role;
