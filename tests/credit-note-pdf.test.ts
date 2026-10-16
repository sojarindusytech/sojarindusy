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
  terms: "Invoice payment terms should not appear on credit notes.", invoice_copies: ["original"],
} as SalesSettings;

describe("shared invoice PDF credit-note variant", () => {
  for (const gst of [true, false]) it(`renders ${gst ? "GST" : "commercial"} credit with the invoice template`, async () => {
    const computed = computeInvoice({ items: [
      { name: "Carbide End Mill 12 mm", description: "Returned items from original invoice", hsn: "82077090", quantity: 2, unitPrice: 1000, discountPct: 10, gstRate: 18 },
      { name: "HSS Twist Drill 8 mm", hsn: "82075000", quantity: 1, unitPrice: 500, gstRate: 18 },
    ], gstEnabled: gst, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
    const invoice = { invoice_number: "SI/CN/26-27/01", invoice_date: "2026-10-16", gst_enabled: gst, bill_to: { name: "Sample Customer Pvt Ltd", address: "Industrial Estate, Vapi, Gujarat", gstin: "24ABCDE5678G1Z9", state: "24-Gujarat" }, place_of_supply: "24-Gujarat", items: computed.lines, totals: computed.totals, amount_in_words: amountInWords(computed.totals.total) } as Invoice;
    const pdf = await renderToBuffer(React.createElement(InvoicePdf, { invoice, settings, creditNote: { invoiceNumber: "SI/INV/26-27/20", invoiceDate: "2026-10-12", reason: "Damaged tools returned after inspection.", treatment: gst ? "gst" : "commercial" } }) as never);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    if (process.env.CREDIT_NOTE_PREVIEW_DIR) {
      mkdirSync(process.env.CREDIT_NOTE_PREVIEW_DIR, { recursive: true });
      writeFileSync(`${process.env.CREDIT_NOTE_PREVIEW_DIR}/${gst ? "gst" : "commercial"}-credit-note.pdf`, pdf);
    }
  });
});
