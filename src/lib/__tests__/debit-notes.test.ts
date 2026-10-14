import { describe, expect, it } from "vitest";
import {
  DEBIT_NOTE_NUMBER_PATTERN,
  DEBIT_NOTE_REASONS,
  debitNoteNumberLength,
  debitNoteReasonLabel,
} from "../debit-notes";
import { issueDebitNoteSchema } from "../validations/debit-note";
import { salesSettingsSchema } from "../validations/sales-settings";

const line = { name: "TD-8", sku: "TD-8", hsn: "82075000", quantity: 10, unitPrice: 5, gstRate: 18 };
const valid = {
  requestId: "4f6c8e2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
  invoiceId: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  debitNoteDate: "2026-10-14",
  reason: "price_increase",
  reasonNote: null,
  manualNumber: null,
  lines: [line],
};
const issueError = (over: Record<string, unknown>) => {
  const r = issueDebitNoteSchema.safeParse({ ...valid, ...over });
  return r.success ? null : r.error.issues[0]?.message;
};

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

  it("labels every reason", () => {
    for (const r of DEBIT_NOTE_REASONS) expect(debitNoteReasonLabel(r.value)).toBe(r.label);
  });
});

describe("issueDebitNoteSchema", () => {
  it("accepts a valid note", () => {
    expect(issueError({})).toBeNull();
  });

  it("needs a note when the reason is Other", () => {
    expect(issueError({ reason: "other" })).toBe("Describe the reason in a few words.");
    expect(issueError({ reason: "other", reasonNote: "Loading charges" })).toBeNull();
  });

  it("checks a typed number against the GST rule", () => {
    expect(issueError({ manualNumber: "SI/DN/25-26/04" })).toBeNull();
    expect(issueError({ manualNumber: "DN_04" })).toMatch(/16 letters, digits/);
    expect(issueError({ manualNumber: "  " })).toBeNull(); // blank = next auto number
  });

  it("validates lines", () => {
    expect(issueError({ lines: [] })).toBe("Add at least one line.");
    expect(issueError({ lines: [{ ...line, unitPrice: 0 }] })).toBe("Rate must be greater than 0.");
    expect(issueError({ lines: [{ ...line, quantity: -1 }] })).toBe("Quantity must be greater than 0.");
    expect(issueError({ lines: [{ ...line, hsn: "82" }] })).toBe("HSN/SAC must be 4 to 8 digits.");
    expect(issueError({ lines: [{ ...line, gstRate: 120 }] })).toBeTruthy();
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
    default_gst_rate: 18,
    invoice_prefix: "SI/INV", invoice_next_number: 1, invoice_pad: 2,
    po_prefix: "SI/PO", po_next_number: 1, po_pad: 2,
    rfq_prefix: "SI/RFQ", rfq_next_number: 1, rfq_pad: 2,
    quote_prefix: "SI/QT", quote_next_number: 1, quote_pad: 2, quote_validity_days: 30,
    receipt_prefix: "SI/RCPT", receipt_next_number: 1, receipt_pad: 2,
    debit_note_prefix: "SI/DN", debit_note_next_number: 1, debit_note_pad: 2,
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
