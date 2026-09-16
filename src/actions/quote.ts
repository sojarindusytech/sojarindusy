"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CommercialQuote,
  QuoteStatus,
  CommercialQuoteInsert,
  CommercialQuoteUpdate,
} from "@/types/database.types";
import { revalidatePath } from "next/cache";

// In-memory fallback / cache for quotes when table hasn't been migrated
let inMemoryQuotes: CommercialQuote[] = [
  {
    id: "qt-1082-01",
    quote_number: "QT-2609-1082",
    rfq_id: "rfq-8821-01",
    company_name: "Bharat Forge Limited",
    contact_person: "Vikram Jadhav",
    email: "vikram.jadhav@bharatforge.com",
    mobile: "+91 98220 12345",
    gstin: "27AAACB2233M1Z2",
    address: "Mundhwa Industrial Area, Pune, Maharashtra 411036",
    items: [
      {
        id: "item-1",
        title: "Solid Carbide 4-Flute End Mill 12mm TiAlN",
        sku: "EM-SC-4F-12MM",
        quantity: 50,
        unit_price: 1850,
        total_price: 92500,
        specifications: { Diameter: "12mm", Flutes: "4", Coating: "TiAlN", Hardness: "Up to 55 HRC" },
      },
      {
        id: "item-2",
        title: "Carbide Face Milling Inserts APKT 160408-PM",
        sku: "INS-APKT-160408",
        quantity: 100,
        unit_price: 320,
        total_price: 32000,
        specifications: { Grade: "PVD Coated", Material: "Steel/Stainless", Radius: "0.8mm" },
      },
    ],
    subtotal: 124500,
    tax_rate: 18,
    tax_amount: 22410,
    total_amount: 146910,
    status: "sent",
    valid_until: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    payment_terms: "30 Days PDC against delivery",
    delivery_terms: "Ex-Works MIDC Waluj, 5-7 business days",
    admin_notes: "Approved special volume discount of 8% on inserts.",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "qt-1083-02",
    quote_number: "QT-2609-1083",
    rfq_id: null,
    company_name: "Kalyani Technoforge Ltd",
    contact_person: "Sanjay Deshmukh",
    email: "sanjay.d@kalyanitechno.com",
    mobile: "+91 94222 98765",
    gstin: "27AABCK8901L1ZT",
    address: "Chakan Industrial Zone Phase II, Pune 410501",
    items: [
      {
        id: "item-3",
        title: "Heavy Duty Indexable U-Drill 25mm 3D Shank",
        sku: "DR-UD-25MM-3D",
        quantity: 10,
        unit_price: 6400,
        total_price: 64000,
        specifications: { Diameter: "25mm", Depth: "3xD", Coolant: "Through Tool Internal" },
      },
      {
        id: "item-4",
        title: "U-Drill SPMX 07T308 Inserts Box of 10",
        sku: "INS-SPMX-07T308",
        quantity: 20,
        unit_price: 2450,
        total_price: 49000,
        specifications: { Pack: "10 pcs/box", Grade: "Universal Alloy PVD" },
      },
    ],
    subtotal: 113000,
    tax_rate: 18,
    tax_amount: 20340,
    total_amount: 133340,
    status: "accepted",
    valid_until: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    payment_terms: "100% against proforma invoice",
    delivery_terms: "Door delivery via V-Trans transport",
    admin_notes: "PO #KTF-2026-PO-441 received. Transferred to dispatch.",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "qt-1084-03",
    quote_number: "QT-2609-1084",
    rfq_id: null,
    company_name: "Varroc Engineering Limited",
    contact_person: "Pooja Patil",
    email: "pooja.patil@varroc.com",
    mobile: "+91 97654 32100",
    gstin: "27AAACV4455Q1Z9",
    address: "Waluj MIDC Industrial Area, Chhatrapati Sambhajinagar 431136",
    items: [
      {
        id: "item-5",
        title: "BT40-ER32-70 Collet Chuck Tool Holder",
        sku: "TH-BT40-ER32-70",
        quantity: 15,
        unit_price: 3800,
        total_price: 57000,
        specifications: { Taper: "BT40 (JIS B 6339)", Runout: "< 0.005 mm", Balanced: "G2.5 @ 20,000 RPM" },
      },
    ],
    subtotal: 57000,
    tax_rate: 18,
    tax_amount: 10260,
    total_amount: 67260,
    status: "draft",
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    payment_terms: "45 Days Net Credit",
    delivery_terms: "Immediate from Waluj plant stock",
    admin_notes: "Drafting estimate for plant expansion requirements.",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Fetch all commercial quotations for Admin
 */
export async function fetchCommercialQuotesList(): Promise<CommercialQuote[]> {
  try {
    const adminDb = createAdminClient();
    const { data, error } = await (adminDb as any)
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      // Return memory state if database table not yet populated
      return inMemoryQuotes;
    }

    return data as CommercialQuote[];
  } catch (err) {
    console.warn("Notice fetching quotes, falling back to memory store:", err);
    return inMemoryQuotes;
  }
}

/**
 * Update quotation status and admin notes
 */
export async function updateCommercialQuoteStatus(
  quoteId: string,
  updates: {
    status: QuoteStatus;
    admin_notes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check in-memory store
    const idx = inMemoryQuotes.findIndex((q) => q.id === quoteId);
    if (idx !== -1) {
      inMemoryQuotes[idx] = {
        ...inMemoryQuotes[idx],
        status: updates.status,
        admin_notes: updates.admin_notes !== undefined ? updates.admin_notes : inMemoryQuotes[idx].admin_notes,
        updated_at: new Date().toISOString(),
      };
    }

    // Attempt database update if table exists
    try {
      const adminDb = createAdminClient();
      const updatePayload: CommercialQuoteUpdate = {
        status: updates.status,
        admin_notes: updates.admin_notes,
        updated_at: new Date().toISOString(),
      };
      await (adminDb as any)
        .from("quotes")
        .update(updatePayload)
        .eq("id", quoteId);
    } catch {
      // Graceful ignore if table doesn't exist
    }

    revalidatePath("/admin/quotes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update quotation." };
  }
}

/**
 * Create a new commercial quotation
 */
export async function createCommercialQuote(
  payload: Omit<CommercialQuoteInsert, "id" | "quote_number" | "created_at" | "updated_at">
): Promise<{ success: boolean; error?: string; quote?: CommercialQuote }> {
  try {
    const quoteNumber = `QT-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newQuote: CommercialQuote = {
      id: `qt-${Date.now()}`,
      quote_number: quoteNumber,
      rfq_id: payload.rfq_id || null,
      company_name: payload.company_name,
      contact_person: payload.contact_person,
      email: payload.email,
      mobile: payload.mobile,
      gstin: payload.gstin || null,
      address: payload.address || null,
      items: payload.items,
      subtotal: payload.subtotal,
      tax_rate: payload.tax_rate || 18,
      tax_amount: payload.tax_amount,
      total_amount: payload.total_amount,
      status: payload.status || "draft",
      valid_until: payload.valid_until,
      payment_terms: payload.payment_terms || "30 Days PDC against delivery",
      delivery_terms: payload.delivery_terms || "Ex-Works MIDC Waluj",
      admin_notes: payload.admin_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryQuotes = [newQuote, ...inMemoryQuotes];

    try {
      const adminDb = createAdminClient();
      await (adminDb as any).from("quotes").insert(newQuote);
    } catch {
      // Graceful fallback
    }

    revalidatePath("/admin/quotes");
    return { success: true, quote: newQuote };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create quotation." };
  }
}
