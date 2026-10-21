import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { StatementPdf } from "@/components/ledger/StatementPdf";
import type { ReportLine } from "@/lib/ledger";
import type { SalesSettings } from "@/types/database.types";

// Vitest's default JSX transform is classic; Next uses the automatic transform.
vi.stubGlobal("React", React);

const settings = {
  company_name: "Sojar Indusy", address: "Vapi, Gujarat, India", state_code: "24", state_name: "Gujarat",
  gstin: "24ABCDE1234F1Z5", email: "accounts@example.test", phone: "0000000000", invoice_copies: ["original"],
} as SalesSettings;

const line = (over: Partial<ReportLine>): ReportLine => ({
  line_id: crypto.randomUUID(), entry_id: crypto.randomUUID(), entry_seq: 1, line_no: 1, entry_date: "2026-10-03",
  voucher_type: "invoice", voucher_number: "SI/INV/26-27/04", source_id: crypto.randomUUID(), is_reversal: false, reversed: false,
  narration: "Sales invoice SI/INV/26-27/04 - Sample Customer", line_narration: null, account_id: "a", account_code: "1100",
  account_name: "Trade Receivables", party_id: "p", debit: 11800, credit: 0, bill_ref: "SI/INV/26-27/04", bill_type: "new", balance: 11800,
  ...over,
});

function documentText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(documentText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return documentText(node.props.children);
  return "";
}

describe("statement of account PDF", () => {
  it("renders opening, entries with running balance, closing and ageing", async () => {
    const lines = [
      line({}),
      line({ voucher_type: "receipt", voucher_number: "SI/RCPT/26-27/02", entry_date: "2026-10-08", narration: "Receipt SI/RCPT/26-27/02 (upi)", debit: 0, credit: 5000, bill_type: "against", balance: 6800 }),
      line({ voucher_type: "credit_note", voucher_number: "SI/CN/26-27/01", entry_date: "2026-10-12", narration: "Credit note SI/CN/26-27/01 against invoice SI/INV/26-27/04", debit: 0, credit: 1180, bill_type: "against", balance: 5620 }),
    ];
    const props = {
      settings,
      party: { name: "Sample Customer Pvt Ltd", address: "Industrial Estate, Vapi", gstin: "24ABCDE5678G1Z9", role: "customer" as const },
      from: "2026-04-01",
      to: "2026-10-21",
      opening: 0,
      lines,
      ageing: { due: 5620, d0_30: 5620, d31_60: 0, d61_90: 0, d90_plus: 0 },
    };
    const doc = StatementPdf(props);
    const text = documentText(doc);
    expect(text).toContain("Sample Customer Pvt Ltd");
    expect(text).toContain("Opening balance");
    expect(text).toContain("SI/RCPT/26-27/02");
    expect(text).toContain("6,800.00 Dr");
    expect(text).toContain("Closing balance");
    expect(text).toContain("5,620.00 Dr");
    expect(text).toContain("0-30 days");

    const pdf = await renderToBuffer(React.createElement(StatementPdf, props) as never);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a manufacturer statement without ageing", async () => {
    const pdf = await renderToBuffer(React.createElement(StatementPdf, {
      settings,
      party: { name: "Maker Works", address: null, gstin: null, role: "manufacturer" },
      from: "2026-04-01",
      to: "2026-10-21",
      opening: -8000,
      lines: [line({ voucher_type: "supplier_payment", voucher_number: "SI/PAY/26-27/01", narration: "Payment SI/PAY/26-27/01 to Maker Works", debit: 5000, credit: 0, balance: -3000 })],
      ageing: null,
    }) as never);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
