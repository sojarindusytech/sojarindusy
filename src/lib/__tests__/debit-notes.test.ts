import { describe, expect, it } from "vitest";
import {
  billedRate,
  buildDebitNoteLines,
  DEBIT_NOTE_NUMBER_PATTERN,
  DEBIT_NOTE_REASONS,
  debitNoteNumberLength,
  debitNoteReasonLabel,
  lineKindFor,
  principalGstRate,
  type DebitNoteAdjustment,
} from "../debit-notes";
import { computeInvoice, type InvoiceLine } from "../invoice";
import { issueDebitNoteSchema } from "../validations/debit-note";
import { salesSettingsSchema } from "../validations/sales-settings";

/** An invoice as stored: 10 end mills at ₹100 less 10%, and 2 drills at ₹500, at 12% and 18% GST. */
const invoiceItems: InvoiceLine[] = computeInvoice({
  items: [
    { name: "EM-12", sku: "EM-12", hsn: "82075000", quantity: 10, unitPrice: 100, discountPct: 10, gstRate: 12 },
    { name: "TD-8", sku: "TD-8", hsn: "82075000", quantity: 2, unitPrice: 500, gstRate: 18 },
  ],
  gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24",
}).lines;
const invoice = { gst_enabled: true, items: invoiceItems };

/** Builds the lines, then prices them like the server does (intra-state). */
function charge(reason: Parameters<typeof buildDebitNoteLines>[1], adjustments: DebitNoteAdjustment[], inv = invoice) {
  const built = buildDebitNoteLines(inv, reason, adjustments);
  if (!built.ok) throw new Error(built.error);
  return computeInvoice({ items: built.lines, gstEnabled: inv.gst_enabled, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
}
const errorOf = (reason: Parameters<typeof buildDebitNoteLines>[1], adjustments: DebitNoteAdjustment[], inv = invoice) => {
  const built = buildDebitNoteLines(inv, reason, adjustments);
  return built.ok ? null : built.error;
};

describe("amounts by reason", () => {
  it("price revised upward: charges the difference from the billed (after discount) rate", () => {
    expect(billedRate(invoiceItems[0])).toBe(90);
    const dn = charge("price_increase", [{ kind: "rate", line: 0, quantity: 10, newRate: 95 }]);
    expect(dn.lines[0]).toMatchObject({ name: "EM-12", quantity: 10, unitPrice: 5, taxable: 50, gstRate: 12, cgst: 3, sgst: 3 });
    expect(dn.lines[0].description).toBe("Rate revised from Rs. 90.00 to Rs. 95.00 per Pcs");
    expect(dn.totals.total).toBe(56);
  });

  it("price revised upward: refuses a lower rate or more units than billed", () => {
    expect(errorOf("price_increase", [{ kind: "rate", line: 0, quantity: 10, newRate: 90 }])).toBe(
      "The new rate for EM-12 must be higher than the billed ₹90.00."
    );
    expect(errorOf("price_increase", [{ kind: "rate", line: 1, quantity: 3, newRate: 600 }])).toBe(
      "Quantity for TD-8 must be between 1 and the 2 billed."
    );
  });

  it("quantity under-billed: charges extra units at the rate and the line's GST", () => {
    const dn = charge("quantity_short_billed", [{ kind: "quantity", line: 1, quantity: 1, rate: 500 }]);
    expect(dn.lines[0]).toMatchObject({ name: "TD-8", quantity: 1, taxable: 500, gstRate: 18, cgst: 45, sgst: 45 });
    expect(dn.totals.total).toBe(590);
  });

  it("additional charges: lump sums at the goods' GST rate unless changed", () => {
    expect(principalGstRate(invoiceItems)).toBe(18); // TD-8 has the larger value (1000 vs 900)
    const dn = charge("additional_charges", [
      { kind: "charge", label: "Freight charges", amount: 1000, gstRate: null },
      { kind: "charge", label: "Loading & unloading", amount: 200, gstRate: 5, hsn: "996719" },
    ]);
    expect(dn.lines.map((l) => [l.name, l.taxable, l.gstRate, l.hsn])).toEqual([
      ["Freight charges", 1000, 18, null],
      ["Loading & unloading", 200, 5, "996719"],
    ]);
    expect(dn.totals.total).toBe(1000 + 180 + 200 + 10);
  });

  it("GST charged too low: only the missing tax, with no extra taxable value", () => {
    const dn = charge("tax_rate_correction", [{ kind: "tax", line: 0, correctRate: 18 }]);
    // Billed 900 at 12%; due 18%: the note charges 6% of 900 = 54.
    expect(dn.lines[0]).toMatchObject({ taxable: 0, gstRate: 18, cgst: 27, sgst: 27, amount: 54, taxOnly: { base: 900, chargedRate: 12 } });
    expect(dn.lines[0].description).toBe("GST corrected from 12% to 18% on Rs. 900.00");
    expect(dn.totals).toMatchObject({ taxableTotal: 0, total: 54 });
  });

  it("GST charged too low: needs a higher rate and a GST invoice", () => {
    expect(errorOf("tax_rate_correction", [{ kind: "tax", line: 1, correctRate: 18 }])).toBe(
      "The correct GST rate for TD-8 must be higher than the 18% charged."
    );
    expect(errorOf("tax_rate_correction", [{ kind: "tax", line: 0, correctRate: 18 }], { ...invoice, gst_enabled: false })).toMatch(
      /billed without GST/
    );
  });

  it("other: free lines", () => {
    const dn = charge("other", [{ kind: "custom", name: "Tooling setup", quantity: 1, unitPrice: 2500, gstRate: 18 }]);
    expect(dn.totals.total).toBe(2950);
  });

  it("refuses lines that don't match the reason, unknown invoice lines and duplicates", () => {
    expect(errorOf("price_increase", [{ kind: "quantity", line: 0, quantity: 1, rate: 90 }])).toMatch(/don't match the selected reason/);
    expect(errorOf("price_increase", [{ kind: "rate", line: 7, quantity: 1, newRate: 200 }])).toMatch(/no longer matches the invoice/);
    expect(errorOf("tax_rate_correction", [
      { kind: "tax", line: 0, correctRate: 18 },
      { kind: "tax", line: 0, correctRate: 28 },
    ])).toBe("EM-12 is added twice.");
    expect(errorOf("other", [])).toBe("Add at least one line.");
  });

  it("maps every reason to one kind of line", () => {
    expect(DEBIT_NOTE_REASONS.map((r) => [r.value, lineKindFor(r.value)])).toEqual([
      ["price_increase", "rate"],
      ["quantity_short_billed", "quantity"],
      ["additional_charges", "charge"],
      ["tax_rate_correction", "tax"],
      ["other", "custom"],
    ]);
    for (const r of DEBIT_NOTE_REASONS) expect(debitNoteReasonLabel(r.value)).toBe(r.label);
  });
});

describe("debit note numbers (GST Rule 53)", () => {
  it("allows letters, digits, / and - up to 16 characters", () => {
    expect(DEBIT_NOTE_NUMBER_PATTERN.test("SI/DN/25-26/01")).toBe(true);
    expect(DEBIT_NOTE_NUMBER_PATTERN.test("DN-1234567890123")).toBe(true); // 16
    expect(DEBIT_NOTE_NUMBER_PATTERN.test("DN-12345678901234")).toBe(false); // 17
    expect(DEBIT_NOTE_NUMBER_PATTERN.test("DN_01")).toBe(false);
    expect(DEBIT_NOTE_NUMBER_PATTERN.test("DN 01")).toBe(false);
  });

  it("measures the shortest auto number for a prefix and digit count", () => {
    expect(debitNoteNumberLength("SI/DN", 2)).toBe("SI/DN/25-26/01".length);
    expect(debitNoteNumberLength("SOJAR/DEBIT", 2)).toBe("SOJAR/DEBIT/25-26/01".length);
    expect(debitNoteNumberLength("SI/DN", 8)).toBe("SI/DN/25-26/00000001".length);
  });
});

describe("issueDebitNoteSchema", () => {
  const valid = {
    requestId: "4f6c8e2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
    invoiceId: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    debitNoteDate: "2026-10-14",
    reason: "price_increase",
    reasonNote: null,
    manualNumber: null,
    adjustments: [{ kind: "rate", line: 0, quantity: 10, newRate: 95 }],
  };
  const issueError = (over: Record<string, unknown>) => {
    const r = issueDebitNoteSchema.safeParse({ ...valid, ...over });
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts a valid note", () => {
    expect(issueError({})).toBeNull();
  });

  it("needs a note when the reason is Other", () => {
    const other = { reason: "other", adjustments: [{ kind: "custom", name: "Setup", quantity: 1, unitPrice: 100, gstRate: null }] };
    expect(issueError(other)).toBe("Describe the reason in a few words.");
    expect(issueError({ ...other, reasonNote: "Tooling setup" })).toBeNull();
  });

  it("checks a typed number against the GST rule", () => {
    expect(issueError({ manualNumber: "SI/DN/25-26/04" })).toBeNull();
    expect(issueError({ manualNumber: "DN_04" })).toMatch(/16 letters, digits/);
    expect(issueError({ manualNumber: "  " })).toBeNull(); // blank = next auto number
  });

  it("validates the lines and that they match the reason", () => {
    expect(issueError({ adjustments: [] })).toBe("Add at least one line.");
    expect(issueError({ adjustments: [{ kind: "rate", line: 0, quantity: 0, newRate: 95 }] })).toBe("Quantity must be greater than 0.");
    expect(issueError({ adjustments: [{ kind: "charge", label: "Freight", amount: 0, gstRate: null }] })).toBe("Enter the charge amount.");
    expect(issueError({ adjustments: [{ kind: "charge", label: "Freight", amount: 10, gstRate: null, hsn: "99" }] })).toBe(
      "HSN/SAC must be 4 to 8 digits."
    );
    expect(issueError({ adjustments: [{ kind: "charge", label: "Freight", amount: 10, gstRate: null }] })).toBe(
      "These lines don't match the selected reason."
    );
  });

  it("rejects an unknown reason or a malformed invoice id", () => {
    expect(issueError({ reason: "because" })).toBeTruthy();
    expect(issueError({ invoiceId: "INV-1" })).toBe("Select the invoice this debit note is for.");
  });
});

describe("salesSettingsSchema: debit note series", () => {
  const settings = {
    company_name: "Sojar Indusy",
    address: "Plot 4, GIDC, Ahmedabad",
    gstin: "",
    state_code: "24",
    state_name: "Gujarat",
    email: "",
    gst_billing_enabled: true,
    invoice_reduces_stock: true,
    credit_note_restores_stock: true,
    default_gst_rate: 18,
    invoice_prefix: "SI/INV", invoice_next_number: 1, invoice_pad: 2,
    po_prefix: "SI/PO", po_next_number: 1, po_pad: 2,
    rfq_prefix: "SI/RFQ", rfq_next_number: 1, rfq_pad: 2,
    quote_prefix: "SI/QT", quote_next_number: 1, quote_pad: 2, quote_validity_days: 30,
    receipt_prefix: "SI/RCPT", receipt_next_number: 1, receipt_pad: 2,
    debit_note_prefix: "SI/DN", debit_note_next_number: 1, debit_note_pad: 2,
    credit_note_prefix: "SI/CN", credit_note_next_number: 1, credit_note_pad: 2,
    order_prefix: "SI/ORD", order_next_number: 1, order_pad: 2,
    invoice_copies: ["original"],
  };
  const issues = (over: Record<string, unknown>) => {
    const r = salesSettingsSchema.safeParse({ ...settings, ...over });
    return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
  };

  it("accepts the default series", () => {
    expect(issues({})).toEqual([]);
  });

  it("refuses a series whose numbers would exceed 16 characters", () => {
    expect(issues({ debit_note_prefix: "SOJAR/DEBIT" })).toEqual([
      expect.stringMatching(/^debit_note_prefix: GST allows at most 16 characters/),
    ]);
    expect(issues({ debit_note_prefix: "SI/DN", debit_note_pad: 8 })).toHaveLength(1);
  });

  it("refuses characters GST doesn't allow in the prefix", () => {
    expect(issues({ debit_note_prefix: "SI_DN" })).toEqual(["debit_note_prefix: Use letters, numbers, / and - only."]);
  });
});
