-- Migration: 20261021_po_manufacturer.sql
-- Which manufacturer receives our purchase orders. Sales Settings holds the default; each PO
-- remembers who it went to (purchase_orders.manufacturer_id already exists).

ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS po_manufacturer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.sales_settings.po_manufacturer_id IS
  'Manufacturer account that receives new purchase orders. NULL = every manufacturer sees them.';

-- A manufacturer reads only the POs assigned to them, plus unassigned ones (older POs and
-- anything raised while no manufacturer is set), instead of every PO.
DROP POLICY IF EXISTS "Manufacturer read access on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Manufacturer read access on purchase_orders"
  ON public.purchase_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manufacturer'
    )
    AND (manufacturer_id IS NULL OR manufacturer_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_purchase_orders_manufacturer_id ON public.purchase_orders(manufacturer_id);
