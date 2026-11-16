-- ==============================================================================
-- Migration: 20261025_customer_deactivation
--
-- Deleting a customer must never rewrite history. A customer who has any orders,
-- invoices, quotes, RFQs, credit / debit notes, payments, coupon redemptions,
-- ledger entries or purchase orders is DEACTIVATED instead (login blocked by the
-- app, all documents keep their link). Only a customer with no history is deleted.
-- ==============================================================================

-- 1. When the admin deactivated the account. NULL = active.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- 2. Has this profile ever been used in a business document?
CREATE OR REPLACE FUNCTION public.customer_has_history(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
       EXISTS (SELECT 1 FROM orders             WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM invoices           WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM quotes             WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM rfqs               WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM credit_notes       WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM debit_notes        WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM payments           WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM coupon_redemptions WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM ledger_entries     WHERE party_id = p_user_id)
    OR EXISTS (SELECT 1 FROM ledger_lines       WHERE party_id = p_user_id)
    OR EXISTS (SELECT 1 FROM purchase_orders    WHERE manufacturer_id = p_user_id)
    OR EXISTS (SELECT 1 FROM supplier_payments  WHERE manufacturer_id = p_user_id)
$$;

REVOKE ALL ON FUNCTION public.customer_has_history(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_has_history(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
