"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { amountInWords, computeInvoice, stateCodeOf, type InvoiceLineInput } from "@/lib/invoice";
import { placeOfSupplyFor } from "@/lib/indian-states";
import type { Invoice, InvoiceBillTo, Order, OrderItem, SalesSettings } from "@/types/database.types";
import { revalidatePath } from "next/cache";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

/** Light row for the list screen (no line items). */
export type InvoiceListRow = Pick<
  Invoice,
  "id" | "invoice_number" | "invoice_date" | "bill_to" | "po_number" | "gst_enabled" | "total_amount" | "status" | "order_id" | "created_at"
>;

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

/** Shared by manual and order-based creation. Always recomputes totals server-side. */
async function insertInvoice(args: {
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

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/settings/sales");
  revalidatePath("/dashboard/invoices");
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
  return (data as InvoiceListRow[]) ?? [];
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
  return (data as InvoiceListRow[]) ?? [];
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
  settings: Pick<SalesSettings, "gst_billing_enabled" | "default_gst_rate" | "state_code" | "state_name" | "invoice_prefix" | "invoice_fy" | "invoice_next_number" | "invoice_pad"> | null;
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
}

export async function searchInvoiceSkus(query: string): Promise<InvoiceSkuHit[]> {
  await requireAdmin();
  const q = query.trim().replace(/[%_\\]/g, "\\$&");
  if (q.length < 2) return [];
  const { data, error } = await (createAdminClient().from("product_variants") as any)
    .select("id, sku, list_price, gst_rate, hsn_code, products(title)")
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
    await requireAdmin();
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
      if (error.code === "23505") return { success: false, error: `Invoice number "${number}" already exists.` };
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
    await requireAdmin();
    const { error } = await (createAdminClient().from("invoices") as any)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/invoices");
    revalidatePath("/dashboard/invoices");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel invoice." };
  }
}
