import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { mkdirSync, writeFileSync } from "node:fs";
import { InvoicePdf } from "@/components/invoice/InvoicePdf";
import { computeInvoice, amountInWords } from "@/lib/invoice";
import type { Invoice, SalesSettings } from "@/types/database.types";

// Vitest's default JSX transform is classic; Next uses the automatic transform.
vi.stubGlobal("React", React);
const settings = {
  company_name: "Sojar Indusy", address: "Vapi, Gujarat, India", state_code: "24", state_name: "Gujarat",
  gstin: "24ABCDE1234F1Z5", email: "accounts@example.test", phone: "0000000000",
  bank_name: "Sample bank", account_no: "0000000000", ifsc: "TEST0000001", account_holder: "Sojar Indusy",
  terms: "Invoice payment terms should not appear on credit notes.", invoice_copies: ["original", "duplicate"],
  credit_note_terms: "Credit-specific terms.", debit_note_terms: "Debit-specific terms.", quote_terms: "Quote-specific terms.",
} as SalesSettings;

// Inspect the text and copy sets supplied to react-pdf in addition to rendering real PDF bytes.
function documentText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(documentText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return documentText(node.props.children);
  return "";
}

describe("shared invoice PDF credit-note variant", () => {
  for (const gst of [true, false]) it(`renders ${gst ? "GST" : "commercial"} credit with the invoice template`, async () => {
    const computed = computeInvoice({ items: [
      { name: "Carbide End Mill 12 mm", description: "Returned items from original invoice", hsn: "82077090", quantity: 2, unitPrice: 1000, discountPct: 10, gstRate: 18 },
      { name: "HSS Twist Drill 8 mm", hsn: "82075000", quantity: 1, unitPrice: 500, gstRate: 18 },
    ], gstEnabled: gst, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
    const invoice = { invoice_number: "SI/CN/26-27/01", invoice_date: "2026-10-16", gst_enabled: gst, bill_to: { name: "Sample Customer Pvt Ltd", address: "Industrial Estate, Vapi, Gujarat", gstin: "24ABCDE5678G1Z9", state: "24-Gujarat" }, place_of_supply: "24-Gujarat", items: computed.lines, totals: computed.totals, amount_in_words: amountInWords(computed.totals.total) } as Invoice;
    const document = InvoicePdf({ invoice, settings, creditNote: { invoiceNumber: "SI/INV/26-27/20", invoiceDate: "2026-10-12", reason: "Damaged tools returned after inspection.", treatment: gst ? "gst" : "commercial" } });
    const text = documentText(document);
    expect(document.props.title).toBe(`${gst ? "Credit Note" : "Commercial Credit Note"} SI/CN/26-27/01`);
    expect(React.Children.count(document.props.children)).toBe(1);
    expect(text).toContain("Original Invoice: SI/INV/26-27/20");
    expect(text).toContain("Damaged tools returned after inspection.");
    expect(text).toContain("Total Credit");
    expect(text).toContain("Credit-specific terms.");
    expect(text).toContain(gst ? "GST adjustment against the referenced invoice." : "Commercial credit only. No adjustment to GST liability.");
    expect(text).not.toContain(settings.terms);
    expect(text).not.toContain("Debit-specific terms.");
    expect(text).not.toContain("You Saved");
    const pdf = await renderToBuffer(document);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    if (process.env.CREDIT_NOTE_PREVIEW_DIR) {
      mkdirSync(process.env.CREDIT_NOTE_PREVIEW_DIR, { recursive: true });
      writeFileSync(`${process.env.CREDIT_NOTE_PREVIEW_DIR}/${gst ? "gst" : "commercial"}-credit-note.pdf`, pdf);
    }
  });
});

describe("shared invoice PDF incoming variants", () => {
  for (const variant of ["invoice", "quote", "debit", "debit-tax"] as const) it(`renders ${variant} with its own terms and copy rules`, async () => {
    const isDebit = variant.startsWith("debit");
    const computed = computeInvoice({
      items: [{ name: "End Mill", quantity: 1, unitPrice: 1000, gstRate: 18,
        ...(variant === "debit-tax" ? { taxOnly: { base: 1000, chargedRate: 15 } } : {}),
      }],
      gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24",
    });
    const invoice = {
      invoice_number: "TEST/26-27/01", invoice_date: "2026-10-19", gst_enabled: true,
      bill_to: { name: "Sample Customer" }, items: computed.lines, totals: computed.totals,
      amount_in_words: amountInWords(computed.totals.total),
    } as Invoice;
    const document = InvoicePdf({
      invoice, settings,
      ...(variant === "quote" ? { quote: { validUntil: "2026-11-19", paymentTerms: "Advance payment" } } : {}),
      ...(isDebit ? { debitNote: { invoiceNumber: "SI/INV/26-27/20", invoiceDate: "2026-10-12", reason: "Adjustment", note: "Reviewed" } } : {}),
    });
    const text = documentText(document);
    const label = isDebit ? "Debit Note" : variant === "quote" ? "Quotation" : "Invoice";
    expect(text).toContain(`${label} Details`);
    expect(text).toContain(`${label} Amount In Words`);
    expect(React.Children.count(document.props.children)).toBe(variant === "invoice" ? 2 : 1);
    expect(text).toContain(isDebit ? "Debit-specific terms." : variant === "quote" ? "Quote-specific terms." : settings.terms);
    expect(text).not.toContain("Credit-specific terms.");
    expect(text).not.toContain("Total Credit");
    if (isDebit) {
      expect(text).toContain("Against Invoice No.: SI/INV/26-27/20");
      expect(text).toContain("Reason: Adjustment (Reviewed)");
      expect(text).not.toContain("Discount");
    }
    if (variant === "debit-tax") {
      expect(text).toContain("1.5%");
      expect(text).not.toContain("9.0%");
    }
    const pdf = await renderToBuffer(document);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
