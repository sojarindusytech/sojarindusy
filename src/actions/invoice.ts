"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { amountInWords, computeInvoice, stateCodeOf, type InvoiceLineInput } from "@/lib/invoice";
import { placeOfSupplyFor } from "@/lib/indian-states";
import type { Invoice, InvoiceBillTo, Order, OrderItem, SalesSettings } from "@/types/database.types";
import { revalidatePath } from "next/cache";
import {
  checkInvoiceStock,
  postInvoiceStock,
  reverseInvoiceStock,
  repostInvoiceStock,
  type StockLine,
} from "@/lib/server/rpc";
import { shortageMessage, stockErrorMessage } from "@/lib/server/stock-errors";
import { parseDbError } from "@/lib/server/db-error";
import { paymentErrorMessage } from "@/lib/server/payment-errors";
import { filterCustomerVisibleInvoices } from "@/lib/server/invoice-access";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

/** Light row for the list screen (no line items). */
export type InvoiceListRow = Pick<
  Invoice,
  "id" | "invoice_number" | "invoice_date" | "bill_to" | "po_number" | "gst_enabled" | "total_amount" | "status" | "order_id" | "created_at"
> & {
  /** Money received against it (admin list only; from the invoice_payment_summary view). */
  paid?: number;
  balance?: number;
  payment_status?: "unpaid" | "partial" | "paid" | "cancelled";
};

/** The two database guards that protect an invoice that has received money, in plain words. */
function invoiceGuardMessage(error: { message?: string; details?: string | null; code?: string }): string | null {
  const parsed = parseDbError(error);
  return parsed.code === "INVOICE_HAS_PAYMENTS" || parsed.code === "TOTAL_BELOW_PAID" ? paymentErrorMessage(parsed) : null;
}

export interface ManualInvoicePayload {
  customerId?: string | null;
  billTo: InvoiceBillTo;
  /** "24-Gujarat". Blank = seller's own state. */
  placeOfSupply?: string | null;
  invoiceDate: string;
  poNumber?: string | null;
  gstEnabled: boolean;
  /** Typed number. Blank = next auto number. */
  manualNumber?: string | null;
  lines: InvoiceLineInput[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Catalogue lines only: custom lines (no SKU) never move stock. */
const stockLines = (lines: { sku?: string | null; quantity: number }[]): StockLine[] =>
  lines.filter((l) => l.sku).map((l) => ({ sku: l.sku as string, quantity: Number(l.quantity) }));

const qtyBySku = (lines: StockLine[]) => {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.sku, (m.get(l.sku) ?? 0) + l.quantity);
  return m;
};

/**
 * Shared by manual and order-based creation. Always recomputes totals server-side.
 *
 * stockOwner decides who moves the SKU units:
 *   "order"   the linked order did (at shipment); the invoice must not touch stock again
 *   "invoice" a hand-made invoice: issuing it takes the units off the shelf
 *   "none"    no stock effect (the Sales Settings switch is off)
 */
async function insertInvoice(args: {
  stockOwner: "order" | "invoice" | "none";
  settings: SalesSettings;
  billTo: InvoiceBillTo;
  userId: string | null;
  orderId: string | null;
  createdBy: string | null;
  invoiceDate: string;
  poNumber: string | null;
  placeOfSupply: string | null;
  gstEnabled: boolean;
  manualNumber: string | null;
  lines: InvoiceLineInput[];
}): Promise<Result<{ invoice: Invoice }>> {
  const { settings } = args;
  const db = createAdminClient();

  // Refuse before an invoice number is used up: a shortage never leaves a gap in the series.
  if (args.stockOwner === "invoice") {
    const lines = stockLines(args.lines);
    if (lines.length > 0) {
      const check = await checkInvoiceStock(lines);
      if (check.error) return { success: false, error: "Could not check stock for this invoice. Please try again." };
      if (check.data.length > 0) return { success: false, error: shortageMessage(check.data) };
    }
  }

  const placeOfSupply = args.placeOfSupply || `${settings.state_code}-${settings.state_name}`;
  const computed = computeInvoice({
    items: args.lines,
    gstEnabled: args.gstEnabled,
    defaultGstRate: settings.default_gst_rate,
    sellerStateCode: settings.state_code,
    placeOfSupplyStateCode: stateCodeOf(placeOfSupply),
  });

  let invoiceNumber: string;
  let fy: string | null = null;
  let seq: number | null = null;

  if (args.manualNumber) {
    const { data: dup } = await (db.from("invoices") as any)
      .select("id")
      .eq("invoice_number", args.manualNumber)
      .maybeSingle();
    if (dup) return { success: false, error: `Invoice number "${args.manualNumber}" already exists.` };
    invoiceNumber = args.manualNumber;
  } else {
    // Atomic in the DB. If the insert below then fails the number is skipped;
    // a gap is acceptable, a duplicate is not.
    const { data: num, error: numErr } = await (db as any).rpc("next_invoice_number");
    if (numErr || !num) {
      console.error("[insertInvoice] next_invoice_number failed:", numErr);
      return { success: false, error: numErr?.message || "Could not allocate an invoice number." };
    }
    invoiceNumber = num as string;
    const parts = invoiceNumber.split("/");
    seq = Number(parts[parts.length - 1]) || null;
    fy = parts[parts.length - 2] ?? null;
  }

  const row = {
    invoice_number: invoiceNumber,
    invoice_fy: fy,
    seq,
    order_id: args.orderId,
    user_id: args.userId,
    invoice_date: args.invoiceDate,
    po_number: args.poNumber,
    place_of_supply: placeOfSupply,
    gst_enabled: args.gstEnabled,
    bill_to: args.billTo,
    items: computed.lines,
    totals: computed.totals,
    total_amount: computed.totals.total,
    amount_in_words: amountInWords(computed.totals.total),
    status: "issued",
    stock_owner: args.stockOwner,
    created_by: args.createdBy,
  };

  const { data, error } = await (db.from("invoices") as any).insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") {
      // Same order invoiced concurrently, or a manual number taken in between.
      if (args.orderId) {
        const { data: existing } = await (db.from("invoices") as any).select("*").eq("order_id", args.orderId).maybeSingle();
        if (existing) return { success: true, invoice: existing as Invoice };
      }
      return { success: false, error: `Invoice number "${invoiceNumber}" already exists.` };
    }
    console.error("[insertInvoice] insert failed:", error);
    return { success: false, error: error.message };
  }

  // A hand-made invoice takes its units off the shelf now. The pre-check above makes a failure
  // here a race (someone else took the stock a moment ago): do not leave an issued invoice
  // that never moved its stock; cancel it, the number stays in the books.
  if (args.stockOwner === "invoice" && args.createdBy) {
    const posted = await postInvoiceStock((data as Invoice).id, args.createdBy);
    if (posted.error) {
      await (db.from("invoices") as any)
        .update({ status: "cancelled", stock_owner: "none", updated_at: new Date().toISOString() })
        .eq("id", (data as Invoice).id);
      revalidatePath("/admin/invoices");
      return {
        success: false,
        error: stockErrorMessage(posted.error) ?? "Could not reduce stock for this invoice, so it was not issued. Please try again.",
      };
    }
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/settings/sales");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/admin/products");
  return { success: true, invoice: data as Invoice };
}

export async function listInvoices(): Promise<InvoiceListRow[]> {
  await requireAdmin();
  const { data, error } = await (createAdminClient().from("invoices") as any)
    .select("id, invoice_number, invoice_date, bill_to, po_number, gst_enabled, total_amount, status, order_id, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listInvoices] Query error:", error);
    return [];
  }
  const rows = (data as InvoiceListRow[]) ?? [];

  // Paid / balance / status come from the payments module.
  const { data: sums } = await (createAdminClient().from("invoice_payment_summary" as never) as any)
    .select("invoice_id, paid, balance, payment_status");
  const byId = new Map<string, { paid: number | string; balance: number | string; payment_status: InvoiceListRow["payment_status"] }>(
    ((sums as any[]) ?? []).map((r) => [r.invoice_id, r])
  );
  return rows.map((r) => {
    const s = byId.get(r.id);
    return s ? { ...r, paid: Number(s.paid), balance: Number(s.balance), payment_status: s.payment_status } : r;
  });
}

/** The signed-in customer's own issued invoices. Never accepts a user id from the client. */
export async function fetchCustomerInvoices(): Promise<InvoiceListRow[]> {
  const ctx = await requireUser();
  const { data, error } = await (createAdminClient().from("invoices") as any)
    .select("id, invoice_number, invoice_date, bill_to, po_number, gst_enabled, total_amount, status, order_id, created_at")
    .eq("user_id", ctx.userId)
    .eq("status", "issued")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchCustomerInvoices] Query error:", error);
    return [];
  }
  // An order's invoice is raised at shipment but only shown once the order is delivered.
  return filterCustomerVisibleInvoices((data as InvoiceListRow[]) ?? []);
}

export interface InvoiceFormCustomer {
  id: string;
  company_name: string;
  contact_name: string;
  mobile: string;
  email: string;
  address: string;
  gstin: string | null;
  /** "24-Gujarat" or null if the profile's state wasn't recognised. */
  place_of_supply: string | null;
}

/** Everything the "New Invoice" form needs besides SKU search. */
export async function getInvoiceFormData(): Promise<{
  settings: Pick<SalesSettings, "gst_billing_enabled" | "default_gst_rate" | "state_code" | "state_name" | "invoice_prefix" | "invoice_fy" | "invoice_next_number" | "invoice_pad" | "invoice_reduces_stock"> | null;
  customers: InvoiceFormCustomer[];
}> {
  await requireAdmin();
  const settings = await loadSalesSettings();
  const { data } = await (createAdminClient().from("profiles") as any)
    .select("id, company_name, first_name, last_name, mobile, email, company_address, city, state, pincode, gstin")
    .eq("role", "customer")
    .order("company_name", { ascending: true });

  const customers: InvoiceFormCustomer[] = ((data as any[]) ?? []).map((p) => ({
    id: p.id,
    company_name: p.company_name,
    contact_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    mobile: p.mobile ?? "",
    email: p.email ?? "",
    address: [p.company_address, p.city, p.pincode].filter(Boolean).join(", "),
    gstin: p.gstin ?? null,
    place_of_supply: placeOfSupplyFor(p.state),
  }));

  return { settings, customers };
}

export interface InvoiceSkuHit {
  /** product_variants.id (used by the purchase-order form). */
  id: string;
  sku: string;
  title: string;
  list_price: number;
  gst_rate: number | null;
  hsn_code: string | null;
  /** Units that can still be sold: on hand minus reserved by open orders. */
  available: number;
}

export async function searchInvoiceSkus(query: string): Promise<InvoiceSkuHit[]> {
  await requireAdmin();
  const q = query.trim().replace(/[%_\\]/g, "\\$&");
  if (q.length < 2) return [];
  const { data, error } = await (createAdminClient().from("product_variants") as any)
    .select("id, sku, list_price, gst_rate, hsn_code, stock_quantity, reserved_quantity, products(title)")
    .eq("is_archived", false)
    .ilike("sku", `%${q}%`)
    .order("sku", { ascending: true })
    .limit(15);
  if (error) {
    console.error("[searchInvoiceSkus] Query error:", error);
    return [];
  }
  return ((data as any[]) ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.products?.title ?? "",
    list_price: Number(v.list_price) || 0,
    gst_rate: v.gst_rate === null || v.gst_rate === undefined ? null : Number(v.gst_rate),
    hsn_code: v.hsn_code ?? null,
    available: Math.max(0, (Number(v.stock_quantity) || 0) - (Number(v.reserved_quantity) || 0)),
  }));
}

/** Shared by create and edit: trims, validates and normalises the form payload. */
function parseInvoicePayload(
  payload: ManualInvoicePayload
): { error: string } | { billTo: InvoiceBillTo; lines: InvoiceLineInput[]; number: string | null } {
  const name = payload.billTo?.name?.trim();
  if (!name) return { error: "Customer name is required." };
  if (!DATE_RE.test(payload.invoiceDate)) return { error: "Invoice date is invalid." };
  const lines = (payload.lines ?? []).filter((l) => l.name?.trim());
  if (lines.length === 0) return { error: "Add at least one item." };
  for (const l of lines) {
    if (!(Number(l.quantity) > 0)) return { error: `Quantity for "${l.name}" must be greater than 0.` };
    if (!(Number(l.unitPrice) >= 0)) return { error: `Price for "${l.name}" is invalid.` };
  }
  const number = payload.manualNumber?.trim() || null;
  if (number && number.length > 50) return { error: "Invoice number is too long." };

  return {
    billTo: {
      name,
      address: payload.billTo.address?.trim() ?? "",
      contact: payload.billTo.contact?.trim() || null,
      gstin: payload.billTo.gstin?.trim().toUpperCase() || null,
      state: payload.placeOfSupply || payload.billTo.state || null,
    },
    lines: lines.map((l) => ({ ...l, name: l.name.trim() })),
    number,
  };
}

export async function createManualInvoice(payload: ManualInvoicePayload): Promise<Result<{ invoice: Invoice }>> {
  try {
    const ctx = await requireAdmin();
    const settings = await loadSalesSettings();
    if (!settings) return { success: false, error: "Sales settings are not configured." };

    const parsed = parseInvoicePayload(payload);
    if ("error" in parsed) return { success: false, error: parsed.error };

    return await insertInvoice({
      stockOwner: settings.invoice_reduces_stock === false ? "none" : "invoice",
      settings,
      billTo: parsed.billTo,
      userId: payload.customerId || null,
      orderId: null,
      createdBy: ctx.userId,
      invoiceDate: payload.invoiceDate,
      poNumber: payload.poNumber?.trim() || null,
      placeOfSupply: payload.placeOfSupply || null,
      gstEnabled: payload.gstEnabled,
      manualNumber: parsed.number,
      lines: parsed.lines,
    });
  } catch (err) {
    console.error("[createManualInvoice] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create invoice." };
  }
}

/** Full invoice (with lines) for the edit form. */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  await requireAdmin();
  const { data } = await (createAdminClient().from("invoices") as any).select("*").eq("id", invoiceId).maybeSingle();
  return (data as Invoice | null) ?? null;
}

/**
 * Edit an issued invoice in place. Totals are recomputed from the submitted
 * lines. `manualNumber` is the invoice number to keep or change: a changed
 * number is checked for duplicates and detaches the invoice from the auto
 * counter (seq cleared). Cancelled invoices are frozen.
 */
export async function updateInvoice(
  invoiceId: string,
  payload: ManualInvoicePayload
): Promise<Result<{ invoice: Invoice }>> {
  try {
    const ctx = await requireAdmin();
    const db = createAdminClient();
    const settings = await loadSalesSettings();
    if (!settings) return { success: false, error: "Sales settings are not configured." };

    const { data: existingData } = await (db.from("invoices") as any).select("*").eq("id", invoiceId).maybeSingle();
    const existing = existingData as Invoice | null;
    if (!existing) return { success: false, error: "Invoice not found." };
    if (existing.status === "cancelled") return { success: false, error: "A cancelled invoice cannot be edited." };

    const parsed = parseInvoicePayload(payload);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const number = parsed.number ?? existing.invoice_number;
    const numberChanged = number !== existing.invoice_number;
    if (numberChanged) {
      const { data: dup } = await (db.from("invoices") as any)
        .select("id")
        .eq("invoice_number", number)
        .neq("id", invoiceId)
        .maybeSingle();
      if (dup) return { success: false, error: `Invoice number "${number}" already exists.` };
    }

    const placeOfSupply = payload.placeOfSupply || `${settings.state_code}-${settings.state_name}`;
    const computed = computeInvoice({
      items: parsed.lines,
      gstEnabled: payload.gstEnabled,
      defaultGstRate: settings.default_gst_rate,
      sellerStateCode: settings.state_code,
      placeOfSupplyStateCode: stateCodeOf(placeOfSupply),
    });

    // Stock: a hand-made invoice changes stock by the difference; an order's invoice cannot
    // change quantities at all (the order owns that stock: use a return or a credit note).
    const oldStock = stockLines(existing.items);
    const newStock = stockLines(computed.lines);
    if (existing.stock_owner === "order") {
      const a = qtyBySku(oldStock);
      const b = qtyBySku(newStock);
      const same = a.size === b.size && [...a].every(([sku, q]) => b.get(sku) === q);
      if (!same) {
        return {
          success: false,
          error: "This invoice belongs to an order, so item quantities can't be changed here. Use an order return or a credit note.",
        };
      }
    }
    let stockAdjusted = false;
    if (existing.stock_owner === "invoice" && existing.stock_posted_at && !existing.stock_reversed_at) {
      const adj = await repostInvoiceStock(invoiceId, ctx.userId, oldStock, newStock);
      if (adj.error) {
        return { success: false, error: stockErrorMessage(adj.error) ?? "Could not update stock for this edit. Please try again." };
      }
      stockAdjusted = true;
    }

    const update = {
      invoice_number: number,
      // A hand-typed number no longer belongs to the auto sequence.
      ...(numberChanged ? { seq: null, invoice_fy: null } : {}),
      // Only a deliberately picked customer re-links the invoice; typing details by hand
      // must not cut the original customer off from their own invoice.
      ...(payload.customerId ? { user_id: payload.customerId } : {}),
      invoice_date: payload.invoiceDate,
      po_number: payload.poNumber?.trim() || null,
      place_of_supply: placeOfSupply,
      gst_enabled: payload.gstEnabled,
      bill_to: { ...parsed.billTo, state: placeOfSupply },
      items: computed.lines,
      totals: computed.totals,
      total_amount: computed.totals.total,
      amount_in_words: amountInWords(computed.totals.total),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (db.from("invoices") as any).update(update).eq("id", invoiceId).select("*").single();
    if (error) {
      // The edit was not saved: put the stock back the way the saved invoice has it.
      if (stockAdjusted) await repostInvoiceStock(invoiceId, ctx.userId, newStock, oldStock);
      if (error.code === "23505") return { success: false, error: `Invoice number "${number}" already exists.` };
      const guard = invoiceGuardMessage(error);
      if (guard) return { success: false, error: guard };
      console.error("[updateInvoice] update failed:", error);
      return { success: false, error: error.message };
    }

    // The order screens read orders.invoice_number; keep it in step.
    if (numberChanged && existing.order_id) {
      await (db.from("orders") as any).update({ invoice_number: number }).eq("id", existing.order_id);
      revalidatePath("/admin/orders");
    }

    revalidatePath("/admin/invoices");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/admin/products");
    return { success: true, invoice: data as Invoice };
  } catch (err) {
    console.error("[updateInvoice] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update invoice." };
  }
}

/**
 * Idempotent: an order has at most one invoice. Called when an order is
 * delivered, and available to admins as a manual retry.
 *
 * Orders placed with per-line GST (orders.tax_snapshot set) are invoiced
 * exactly as charged: each line's coupon discount and GST rate, and the GST
 * basis (billing on/off, place of supply) from the order, not today's
 * settings. Older orders fall back to the SKU's current GST rate.
 */
export async function createInvoiceFromOrder(orderId: string): Promise<Result<{ invoice: Invoice }>> {
  try {
    const ctx = await requireAdmin();
    const db = createAdminClient();

    const { data: existing } = await (db.from("invoices") as any).select("*").eq("order_id", orderId).maybeSingle();
    if (existing) return { success: true, invoice: existing as Invoice };

    const settings = await loadSalesSettings();
    if (!settings) return { success: false, error: "Sales settings are not configured." };

    const { data: orderData, error: orderErr } = await (db.from("orders") as any).select("*").eq("id", orderId).single();
    const order = orderData as Order | null;
    if (orderErr || !order) return { success: false, error: "Order not found." };

    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return { success: false, error: "Order has no items to invoice." };

    const skus = items.map((i) => i.sku).filter(Boolean);
    const { data: variants } = await (db.from("product_variants") as any)
      .select("sku, gst_rate, hsn_code")
      .in("sku", skus);
    const bySku = new Map<string, { gst_rate: number | null; hsn_code: string | null }>(
      ((variants as any[]) ?? []).map((v) => [v.sku, v])
    );

    const { data: profile } = await (db.from("profiles") as any)
      .select("company_name, company_address, city, state, pincode, gstin, mobile, first_name, last_name")
      .eq("id", order.user_id)
      .maybeSingle();

    const cd = order.customer_details;
    const stateName = cd?.state || profile?.state || null;
    const tax = order.tax_snapshot ?? null;
    const placeOfSupply = tax ? tax.place_of_supply : placeOfSupplyFor(stateName);

    const lines: InvoiceLineInput[] = items.map((i) => {
      const v = bySku.get(i.sku);
      const pricing: Pick<InvoiceLineInput, "discountPct" | "discountAmount" | "gstRate"> = tax
        ? { discountAmount: Number(i.discount_amount) || 0, gstRate: Number(i.gst_rate) || 0 }
        : { discountPct: 0, gstRate: v?.gst_rate === null || v?.gst_rate === undefined ? null : Number(v.gst_rate) };
      return {
        name: i.sku || i.name,
        sku: i.sku,
        description: i.sku ? i.name : null,
        hsn: v?.hsn_code ?? null,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        ...pricing,
      };
    });

    const result = await insertInvoice({
      // The order moved the stock when it shipped; this invoice must not do it again.
      stockOwner: "order",
      settings,
      billTo: {
        name: cd?.company_name || profile?.company_name || "Customer",
        address:
          [profile?.company_address, profile?.city || cd?.city, profile?.pincode || cd?.pincode].filter(Boolean).join(", ") ||
          order.shipping_address,
        contact: cd?.mobile || profile?.mobile || null,
        gstin: cd?.gstin || profile?.gstin || null,
        state: placeOfSupply ?? stateName,
      },
      userId: order.user_id,
      orderId: order.id,
      createdBy: ctx.userId,
      invoiceDate: todayIso(),
      poNumber: order.order_number,
      placeOfSupply,
      gstEnabled: tax ? tax.gst_enabled : settings.gst_billing_enabled,
      manualNumber: null,
      lines,
    });

    return result;
  } catch (err) {
    console.error("[createInvoiceFromOrder] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create invoice." };
  }
}

/** Cancel, never delete: the number stays in the books. */
export async function cancelInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin();
    const db = createAdminClient();

    const { data: inv } = await (db.from("invoices") as any).select("id, status, stock_owner").eq("id", invoiceId).maybeSingle();
    if (!inv) return { success: false, error: "Invoice not found." };
    if (inv.status === "cancelled") return { success: true };
    if (inv.stock_owner === "order") {
      // The order shipped these goods; cancelling the invoice would not bring them back.
      return { success: false, error: "This invoice belongs to a shipped order. Process an order return or issue a credit note instead." };
    }

    const { error } = await (db.from("invoices") as any)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);
    if (error) return { success: false, error: invoiceGuardMessage(error) ?? error.message };

    // A hand-made invoice gives its units back (at most once, enforced in the database).
    if (inv.stock_owner === "invoice") {
      const back = await reverseInvoiceStock(invoiceId, ctx.userId, "invoice cancelled");
      if (back.error) {
        // Do not leave a cancelled invoice whose stock is still taken.
        await (db.from("invoices") as any).update({ status: "issued", updated_at: new Date().toISOString() }).eq("id", invoiceId);
        return { success: false, error: "Could not return the invoice's stock, so it was not cancelled. Please try again." };
      }
    }

    revalidatePath("/admin/invoices");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel invoice." };
  }
}
