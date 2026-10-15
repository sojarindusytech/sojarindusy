"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { AuthorizationError, requireAdmin, requireApprovedCustomer } from "@/lib/auth-guard";
import { loadSalesSettings } from "@/lib/sales-settings";
import { amountInWords, computeInvoice, stateCodeOf, type InvoiceLineInput } from "@/lib/invoice";
import { getInvoiceFormData, type InvoiceFormCustomer } from "@/actions/invoice";
import { placeOfSupplyFor } from "@/lib/indian-states";
import type { CommercialQuote, QuoteStatus, QuoteStatusHistoryEntry, SalesSettings } from "@/types/database.types";
import { revalidatePath } from "next/cache";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Everything the quotation form needs besides SKU search. */
export interface QuoteFormData {
  settings: Pick<
    SalesSettings,
    | "gst_billing_enabled" | "default_gst_rate" | "state_code" | "state_name"
    | "quote_prefix" | "quote_fy" | "quote_next_number" | "quote_pad"
    | "quote_validity_days" | "quote_payment_terms" | "quote_delivery_terms"
  > | null;
  customers: InvoiceFormCustomer[];
  /** RFQs still waiting for a quotation, so one can be turned into a quote. */
  rfqs: Array<{
    id: string;
    rfq_number: string;
    user_id: string | null;
    company_name: string | null;
    contact_person: string | null;
    email: string | null;
    mobile: string | null;
    item_name: string;
    quantity: string;
  }>;
}

export interface CreateQuotePayload {
  customerId?: string | null;
  rfqId?: string | null;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  gstin?: string | null;
  address?: string | null;
  /** "24-Gujarat". Blank = seller's own state. */
  placeOfSupply?: string | null;
  quoteDate: string;
  validUntil: string;
  gstEnabled: boolean;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  adminNotes?: string | null;
  /** "draft" keeps it internal; "sent" is visible to the linked customer. */
  status: Extract<QuoteStatus, "draft" | "sent">;
  /** Typed number. Blank = next auto number. */
  manualNumber?: string | null;
  lines: InvoiceLineInput[];
}

export async function fetchCommercialQuotesList(): Promise<CommercialQuote[]> {
  await requireAdmin();
  const { data, error } = await (createAdminClient().from("quotes") as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchCommercialQuotesList] Query error:", error);
    return [];
  }
  return (data as CommercialQuote[]) ?? [];
}

export async function getQuoteFormData(): Promise<QuoteFormData> {
  await requireAdmin();
  const [{ customers }, settings, rfqRes] = await Promise.all([
    getInvoiceFormData(),
    loadSalesSettings(),
    (createAdminClient().from("rfqs") as any)
      .select("id, rfq_number, user_id, company_name, contact_person, email, mobile, item_name, quantity")
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    settings: settings
      ? {
          gst_billing_enabled: settings.gst_billing_enabled,
          default_gst_rate: settings.default_gst_rate,
          state_code: settings.state_code,
          state_name: settings.state_name,
          quote_prefix: settings.quote_prefix ?? "SI/QT",
          quote_fy: settings.quote_fy ?? null,
          quote_next_number: settings.quote_next_number ?? 1,
          quote_pad: settings.quote_pad ?? 2,
          quote_validity_days: settings.quote_validity_days ?? 30,
          quote_payment_terms: settings.quote_payment_terms ?? null,
          quote_delivery_terms: settings.quote_delivery_terms ?? null,
        }
      : null,
    customers,
    rfqs: (rfqRes.data as QuoteFormData["rfqs"]) ?? [],
  };
}

type QuoteResult = { success: true; quote: CommercialQuote } | { success: false; error: string };

/** Admin-created quotation (the Create Quotation form). */
export async function createCommercialQuote(payload: CreateQuotePayload): Promise<QuoteResult> {
  try {
    const ctx = await requireAdmin();
    return await persistQuote(ctx.userId, payload);
  } catch (err) {
    console.error("[createCommercialQuote] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create quotation." };
  }
}

/**
 * Validate, number (auto or manual), price and store a quotation. Shared by the admin form and the
 * storefront cart; the CALLER is responsible for authorisation.
 */
async function persistQuote(userId: string, payload: CreateQuotePayload): Promise<QuoteResult> {
  try {
    const db = createAdminClient();
    const settings = await loadSalesSettings();
    if (!settings) return { success: false, error: "Sales settings are not configured." };

    const company = payload.company_name?.trim();
    if (!company) return { success: false, error: "Client company name is required." };
    if (!DATE_RE.test(payload.quoteDate)) return { success: false, error: "Quotation date is invalid." };
    if (!DATE_RE.test(payload.validUntil)) return { success: false, error: "Valid-until date is invalid." };
    if (payload.validUntil < payload.quoteDate) return { success: false, error: "Valid-until date cannot be before the quotation date." };

    const lines = (payload.lines ?? []).filter((l) => l.name?.trim());
    if (lines.length === 0) return { success: false, error: "Add at least one item." };
    for (const l of lines) {
      if (!(Number(l.quantity) > 0)) return { success: false, error: `Quantity for "${l.name}" must be greater than 0.` };
      if (!(Number(l.unitPrice) >= 0)) return { success: false, error: `Rate for "${l.name}" is invalid.` };
    }

    const manualNumber = payload.manualNumber?.trim() || null;
    if (manualNumber && manualNumber.length > 50) return { success: false, error: "Quotation number is too long." };

    const placeOfSupply = payload.placeOfSupply || `${settings.state_code}-${settings.state_name}`;
    const computed = computeInvoice({
      items: lines.map((l) => ({ ...l, name: l.name.trim() })),
      gstEnabled: payload.gstEnabled,
      defaultGstRate: settings.default_gst_rate,
      sellerStateCode: settings.state_code,
      placeOfSupplyStateCode: stateCodeOf(placeOfSupply),
    });

    let quoteNumber: string;
    let fy: string | null = null;
    let seq: number | null = null;
    if (manualNumber) {
      const { data: dup } = await (db.from("quotes") as any).select("id").eq("quote_number", manualNumber).maybeSingle();
      if (dup) return { success: false, error: `Quotation number "${manualNumber}" already exists.` };
      quoteNumber = manualNumber;
    } else {
      // Atomic in the DB. A failed insert below leaves a gap, never a duplicate.
      const { data: num, error: numErr } = await (db as any).rpc("next_quote_number");
      if (numErr || !num) {
        console.error("[createCommercialQuote] next_quote_number failed:", numErr);
        return { success: false, error: numErr?.message || "Could not allocate a quotation number." };
      }
      quoteNumber = num as string;
      const parts = quoteNumber.split("/");
      seq = Number(parts[parts.length - 1]) || null;
      fy = parts[parts.length - 2] ?? null;
    }

    const row = {
      quote_number: quoteNumber,
      quote_fy: fy,
      seq,
      rfq_id: payload.rfqId || null,
      user_id: payload.customerId || null,
      quote_date: payload.quoteDate,
      valid_until: payload.validUntil,
      company_name: company,
      contact_person: payload.contact_person?.trim() || null,
      email: payload.email?.trim() || null,
      mobile: payload.mobile?.trim() || null,
      gstin: payload.gstin?.trim().toUpperCase() || null,
      address: payload.address?.trim() || null,
      place_of_supply: placeOfSupply,
      gst_enabled: payload.gstEnabled,
      items: computed.lines,
      totals: computed.totals,
      subtotal: computed.totals.taxableTotal,
      tax_amount: round2(computed.totals.cgstTotal + computed.totals.sgstTotal + computed.totals.igstTotal),
      total_amount: computed.totals.total,
      amount_in_words: amountInWords(computed.totals.total),
      status: payload.status === "sent" ? "sent" : "draft",
      payment_terms: payload.paymentTerms?.trim() || null,
      delivery_terms: payload.deliveryTerms?.trim() || null,
      admin_notes: payload.adminNotes?.trim() || null,
      created_by: userId,
    };

    const { data, error } = await (db.from("quotes") as any).insert(row).select("*").single();
    if (error) {
      if (error.code === "23505") return { success: false, error: `Quotation number "${quoteNumber}" already exists.` };
      console.error("[createCommercialQuote] insert failed:", error);
      return { success: false, error: error.message };
    }

    // Quoting an RFQ moves it along, so it leaves the "waiting for quotation" list.
    if (payload.rfqId) {
      await (db.from("rfqs") as any)
        .update({ status: "quoted", quoted_amount: computed.totals.total, updated_at: new Date().toISOString() })
        .eq("id", payload.rfqId)
        .in("status", ["pending", "reviewing"]);
      revalidatePath("/admin/rfqs");
      revalidatePath("/dashboard/rfqs");
    }

    await logStatusChange(db, (data as CommercialQuote).id, null, row.status as QuoteStatus, "Quotation created", userId);

    revalidatePath("/admin/quotes");
    return { success: true, quote: data as CommercialQuote };
  } catch (err) {
    console.error("[persistQuote] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create quotation." };
  }
}

const CART_QUOTE_NOTE = "Generated from website cart";

/**
 * Storefront "Download as Quote": turns the signed-in customer's cart into a real, numbered quotation
 * (next number from Sales Settings) and returns its id for the PDF download. Prices, GST and HSN are
 * taken from the database, never from the browser. Repeating the same cart within 30 minutes returns
 * the same quotation instead of burning a new number.
 */
export async function createCartQuote(
  cart: Array<{ variantId: string; quantity: number }>
): Promise<{ success: true; quoteId: string; quoteNumber: string } | { success: false; error: string; needsLogin?: boolean }> {
  let userId: string;
  try {
    // A quotation shows prices, which are for approved accounts only.
    userId = (await requireApprovedCustomer()).userId;
  } catch (err) {
    if (err instanceof AuthorizationError && err.message === "Account pending approval.") {
      return { success: false, error: "Quotations are available once your account is approved." };
    }
    return { success: false, error: "Please log in to download a quotation.", needsLogin: true };
  }

  try {
    const wanted = new Map<string, number>();
    for (const l of cart ?? []) {
      const qty = Math.floor(Number(l.quantity));
      if (!l.variantId || !Number.isFinite(qty) || qty < 1 || qty > 100000) {
        return { success: false, error: "Cart contains an invalid quantity." };
      }
      wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + qty);
    }
    if (wanted.size === 0) return { success: false, error: "Cart is empty. Add items to generate a quotation." };
    if (wanted.size > 200) return { success: false, error: "Too many items for one quotation." };

    const db = createAdminClient();
    const settings = await loadSalesSettings();
    if (!settings) return { success: false, error: "Quotations are not available right now." };

    const { data: variantRows } = await (db.from("product_variants") as any)
      .select("id, sku, list_price, gst_rate, hsn_code, is_archived, products(title)")
      .in("id", [...wanted.keys()]);
    const variants = new Map<string, any>(((variantRows as any[]) ?? []).map((v) => [v.id, v]));
    if ([...wanted.keys()].some((id) => !variants.get(id) || variants.get(id).is_archived)) {
      return { success: false, error: "Some items in your cart are no longer available. Please refresh your cart." };
    }

    // Same cart, same customer, recently: hand back the existing quotation.
    const signature = [...wanted.entries()].map(([id, q]) => `${variants.get(id).sku}:${q}`).sort().join("|");
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await (db.from("quotes") as any)
      .select("id, quote_number, items")
      .eq("user_id", userId)
      .eq("admin_notes", CART_QUOTE_NOTE)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const sigOf = (items: Array<{ sku?: string | null; quantity: number }>) =>
      items.map((i) => `${i.sku}:${i.quantity}`).sort().join("|");
    const same = ((recent as any[]) ?? []).find((q) => sigOf(q.items ?? []) === signature);
    if (same) return { success: true, quoteId: same.id, quoteNumber: same.quote_number };

    const { data: profile } = await (db.from("profiles") as any)
      .select("company_name, first_name, last_name, title, email, mobile, gstin, company_address, city, state, pincode")
      .eq("id", userId)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    const valid = new Date(Date.now() + (settings.quote_validity_days ?? 30) * 86400000).toISOString().slice(0, 10);

    const result = await persistQuote(userId, {
      customerId: userId,
      company_name: profile?.company_name || "Customer",
      contact_person: profile ? `${profile.title ?? ""} ${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : null,
      email: profile?.email ?? null,
      mobile: profile?.mobile ?? null,
      gstin: profile?.gstin ?? null,
      address: [profile?.company_address, profile?.city, profile?.pincode].filter(Boolean).join(", ") || null,
      placeOfSupply: placeOfSupplyFor(profile?.state),
      quoteDate: today,
      validUntil: valid,
      // Customer-initiated (online): always GST, like online orders.
      gstEnabled: true,
      paymentTerms: settings.quote_payment_terms,
      deliveryTerms: settings.quote_delivery_terms,
      adminNotes: CART_QUOTE_NOTE,
      status: "sent",
      lines: [...wanted.entries()].map(([id, qty]) => {
        const v = variants.get(id);
        return {
          name: v.sku,
          sku: v.sku,
          description: v.products?.title ?? null,
          hsn: v.hsn_code ?? null,
          quantity: qty,
          unitPrice: Number(v.list_price) || 0,
          discountPct: 0,
          gstRate: v.gst_rate === null || v.gst_rate === undefined ? null : Number(v.gst_rate),
        };
      }),
    });
    if (!result.success) return result;
    return { success: true, quoteId: result.quote.id, quoteNumber: result.quote.quote_number };
  } catch (err) {
    console.error("[createCartQuote] Exception:", err);
    return { success: false, error: "Could not generate the quotation. Please try again." };
  }
}

export async function updateCommercialQuoteStatus(
  quoteId: string,
  updates: { status: QuoteStatus; admin_notes?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin();
    const db = createAdminClient();

    const { data: before } = await (db.from("quotes") as any).select("status").eq("id", quoteId).maybeSingle();
    if (!before) return { success: false, error: "Quotation not found." };

    const { error } = await (db.from("quotes") as any)
      .update({
        status: updates.status,
        ...(updates.admin_notes !== undefined ? { admin_notes: updates.admin_notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);
    if (error) return { success: false, error: error.message };

    // The timeline lives in its own table; only real status changes get a row.
    if (before.status !== updates.status) {
      await logStatusChange(db, quoteId, before.status as QuoteStatus, updates.status, updates.admin_notes ?? null, ctx.userId);
    }
    revalidatePath("/admin/quotes");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update quotation." };
  }
}

/** Append one row to quote_status_history. Never blocks the change it describes. */
async function logStatusChange(
  db: ReturnType<typeof createAdminClient>,
  quoteId: string,
  from: QuoteStatus | null,
  to: QuoteStatus,
  notes: string | null,
  userId: string
) {
  const { error } = await (db.from("quote_status_history") as any).insert({
    quote_id: quoteId,
    from_status: from,
    to_status: to,
    notes: notes?.trim() || null,
    changed_by: userId,
  });
  if (error) console.error("[logStatusChange] failed:", error);
}

/** Status timeline for one quotation, newest first. */
export async function fetchQuoteStatusHistory(quoteId: string): Promise<QuoteStatusHistoryEntry[]> {
  await requireAdmin();
  const { data, error } = await (createAdminClient().from("quote_status_history") as any)
    .select("*, profiles:changed_by(first_name, last_name)")
    .eq("quote_id", quoteId)
    .order("changed_at", { ascending: false });
  if (error) {
    console.error("[fetchQuoteStatusHistory] Query error:", error);
    return [];
  }
  return ((data as any[]) ?? []).map(({ profiles, ...row }) => ({
    ...row,
    changed_by_name: profiles ? `${profiles.first_name ?? ""} ${profiles.last_name ?? ""}`.trim() || null : null,
  }));
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
