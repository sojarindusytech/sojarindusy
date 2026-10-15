import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDbError, type DbAppError } from "@/lib/server/db-error";
import type { OrderTaxSnapshot } from "@/lib/order-pricing";
import type { CouponCheckoutContext, CouponUsageSummary, OrderStatus, Payment } from "@/types/database.types";

/**
 * Typed wrappers around the transactional database functions created by the
 * 20261015_04 migration. They run with the service role, so every caller MUST
 * have authorized the request first (see src/lib/auth-guard.ts).
 *
 * Each wrapper returns `{ data }` or `{ error }` and never throws for business
 * failures, so callers can map error codes to user-facing messages.
 */
export type RpcResult<T> = { data: T; error: null } | { data: null; error: DbAppError };

type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { message: string; details?: string | null; code?: string } | null }>;

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const client = createAdminClient();
  // The hand-written Database type does not declare these functions; this is
  // the single place that bridges the gap.
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
  const { data, error } = await rpc(fn, args);
  if (error) {
    const parsed = parseDbError(error);
    if (parsed.code === "DATABASE_ERROR") {
      console.error(`[rpc:${fn}]`, parsed.raw);
    }
    return { data: null, error: parsed };
  }
  return { data: data as T, error: null };
}

// ---- Orders --------------------------------------------------------------------

export interface PlaceOrderPayload {
  user_id: string;
  idempotency_key: string;
  shipping_address: string;
  notes: string | null;
  customer_details: Record<string, unknown>;
  /** GST basis; per-line amounts below are computed with it (src/lib/order-pricing.ts). */
  tax: OrderTaxSnapshot;
  items: {
    variant_id: string;
    quantity: number;
    unit_price: number;
    name: string;
    specifications: Record<string, unknown>;
    /** This line's share of the coupon discount. */
    discount_amount: number;
    /** Effective GST % (0 when GST billing is off). */
    gst_rate: number;
    cgst: number;
    sgst: number;
    igst: number;
  }[];
  /** Must equal the sum of the line discounts. */
  discount_amount: number;
  coupon: { coupon_id: string; version: number; eligible_subtotal: number } | null;
}

export interface PlaceOrderResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  total_amount: number;
  /** True when this checkout attempt had already created the order. */
  replayed: boolean;
  stock: { variant_id: string; stock_after: number; backordered: number }[];
}

export const placeOrder = (payload: PlaceOrderPayload) =>
  callRpc<PlaceOrderResult>("place_order", { p_order: payload });

export interface OrderStatusChanges {
  courier_partner?: string;
  awb_number?: string;
  tracking_url?: string;
  notes?: string;
  return_reason?: string;
}

export interface TransitionResult {
  order_id: string;
  order_number: string;
  user_id: string;
  previous_status: OrderStatus;
  status: OrderStatus;
  invoice_number: string | null;
  courier_partner: string | null;
  coupons_released: number;
}

export const transitionOrderStatus = (
  orderId: string,
  status: OrderStatus,
  changes: OrderStatusChanges,
  actorId: string
) =>
  callRpc<TransitionResult>("transition_order_status", {
    p_order_id: orderId,
    p_new_status: status,
    p_changes: changes,
    p_actor: actorId,
  });

// ---- Stock and purchase orders ----------------------------------------------------

export type StockAdjustMode = "ADD" | "SUBTRACT" | "SET";

export interface StockAdjustResult {
  variant_id: string;
  sku: string;
  balance_before: number;
  balance_after: number;
}

export const adjustVariantStock = (params: {
  variantId: string;
  mode: StockAdjustMode;
  quantity: number;
  movementType?: string;
  reference?: string | null;
  notes?: string | null;
  actorId: string;
}) =>
  callRpc<StockAdjustResult>("adjust_variant_stock", {
    p_variant_id: params.variantId,
    p_mode: params.mode,
    p_quantity: params.quantity,
    p_movement_type: params.movementType ?? "MANUAL_ADJUSTMENT",
    p_reference: params.reference ?? null,
    p_notes: params.notes ?? null,
    p_actor: params.actorId,
  });

export interface ReceivePurchaseOrderResult {
  already_received: boolean;
  order_number: string;
  sku?: string;
  quantity?: number;
  stock_after?: number | null;
}

export const receivePurchaseOrder = (poId: string, notes: string | null, actorId: string) =>
  callRpc<ReceivePurchaseOrderResult>("receive_purchase_order", {
    p_po_id: poId,
    p_notes: notes,
    p_actor: actorId,
  });

// ---- Invoice stock (20261017_stock_ledger) ---------------------------------------------

export interface StockLine {
  sku: string;
  quantity: number;
}

/** [{ sku, required, available }] for every line that cannot be covered. Read-only. */
export const checkInvoiceStock = (items: StockLine[]) =>
  callRpc<{ sku: string; required: number; available: number }[]>("check_invoice_stock", { p_items: items });

/** Takes the invoice's SKU units off the shelf, exactly once. */
export const postInvoiceStock = (invoiceId: string, actorId: string) =>
  callRpc<{ posted: boolean; invoice_number: string }>("post_invoice_stock", { p_invoice_id: invoiceId, p_actor: actorId });

/** Gives the units back (invoice cancelled), exactly once. */
export const reverseInvoiceStock = (invoiceId: string, actorId: string, reason: string | null = null) =>
  callRpc<{ reversed: boolean; invoice_number: string }>("reverse_invoice_stock", {
    p_invoice_id: invoiceId,
    p_actor: actorId,
    p_reason: reason,
  });

/**
 * An edited invoice changes stock by the difference between its old and new lines. Call it
 * BEFORE saving the new lines; to undo, call again with the two lists swapped.
 */
export const repostInvoiceStock = (invoiceId: string, actorId: string, oldItems: StockLine[], newItems: StockLine[]) =>
  callRpc<{ adjusted: boolean; invoice_number: string }>("repost_invoice_stock", {
    p_invoice_id: invoiceId,
    p_actor: actorId,
    p_old_items: oldItems,
    p_new_items: newItems,
  });

// ---- Payments received (20261018_payments) -----------------------------------------------

export interface RecordPaymentPayload {
  request_id: string;
  user_id: string | null;
  payer_name: string | null;
  payment_date: string;
  amount: number;
  mode: string;
  channel: "ecom" | "offline";
  reference: string | null;
  deposit_account: string | null;
  remarks: string | null;
  manual_number: string | null;
  allocations: { kind: "invoice" | "advance" | "other"; invoice_id?: string; amount: number; note?: string | null }[];
}

/** Validates, locks the invoices, numbers and stores a receipt atomically. Returns the receipt row. */
export const recordPayment = (payload: RecordPaymentPayload, actorId: string) =>
  callRpc<Payment>("record_payment", { p_input: payload, p_actor: actorId });

export const cancelPayment = (paymentId: string, reason: string, actorId: string) =>
  callRpc<{ already_cancelled: boolean; receipt_number: string; amount?: number }>("cancel_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
    p_actor: actorId,
  });

export type DocumentType = "ORD" | "PO";

/** Collision-free fallback numbering (20261015_02); orders use it as their primary. */
export const nextDocumentNumber = (type: DocumentType) =>
  callRpc<string>("next_document_number", { p_doc_type: type });

/** PO number from the Sales Settings counter (20261011_purchase_order_numbering). */
export const nextPoNumber = () => callRpc<string>("next_po_number", {});

// ---- Coupons ------------------------------------------------------------------------

export const getCouponCheckoutContext = (code: string, userId: string) =>
  callRpc<CouponCheckoutContext | null>("coupon_checkout_context", { p_code: code, p_user_id: userId });

export const saveCoupon = (params: {
  coupon: Record<string, unknown>;
  productIds: string[];
  categoryIds: string[];
  customerIds: string[];
  actorId: string;
}) =>
  callRpc<{ id: string; version: number }>("save_coupon", {
    p_coupon: params.coupon,
    p_product_ids: params.productIds,
    p_category_ids: params.categoryIds,
    p_customer_ids: params.customerIds,
    p_actor: params.actorId,
  });

export const removeCoupon = (couponId: string) =>
  callRpc<"deleted" | "archived">("remove_coupon", { p_coupon_id: couponId });

export const getCouponUsageSummary = (couponIds: string[]) =>
  callRpc<CouponUsageSummary[]>("coupon_usage_summary", { p_coupon_ids: couponIds });
