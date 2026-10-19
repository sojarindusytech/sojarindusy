import { describe, expect, it } from "vitest";
import { allocationLabel, autoAllocate } from "../payments";
import { recordPaymentSchema } from "../validations/payment";

const base = {
  requestId: "4f6c8e2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
  customerId: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  payerName: null,
  paymentDate: "2026-10-19",
  amount: 590,
  mode: "bank_transfer",
  channel: "offline",
};
const DN = "11111111-2222-4333-8444-555555555555";
const INV = "66666666-7777-4888-9999-000000000000";
const parse = (allocations: unknown[]) => recordPaymentSchema.safeParse({ ...base, allocations });

describe("payments against debit notes", () => {
  it("accepts a debit note line that points at its debit note", () => {
    expect(parse([{ kind: "debit_note", debitNoteId: DN, amount: 590 }]).success).toBe(true);
    expect(parse([{ kind: "invoice", invoiceId: INV, amount: 400 }, { kind: "debit_note", debitNoteId: DN, amount: 190 }]).success).toBe(true);
  });

  it("refuses a line without its document, or with the wrong one", () => {
    expect(parse([{ kind: "debit_note", amount: 590 }]).success).toBe(false);
    expect(parse([{ kind: "debit_note", invoiceId: INV, amount: 590 }]).success).toBe(false);
    expect(parse([{ kind: "invoice", debitNoteId: DN, amount: 590 }]).success).toBe(false);
    expect(parse([{ kind: "advance", debitNoteId: DN, amount: 590 }]).success).toBe(false);
  });

  it("labels each kind of allocation", () => {
    expect(allocationLabel({ kind: "invoice", invoice_number: "SI/INV/26-27/04" })).toBe("SI/INV/26-27/04");
    expect(allocationLabel({ kind: "debit_note", debit_note_number: "SI/DN/26-27/01" })).toBe("Debit note SI/DN/26-27/01");
    expect(allocationLabel({ kind: "advance" })).toBe("Advance");
    expect(allocationLabel({ kind: "other", note: "Deposit" })).toBe("Other (Deposit)");
    expect(allocationLabel({ kind: "other", note: null })).toBe("Other");
  });

  it("auto-allocates debit notes alongside invoices, oldest first", () => {
    const r = autoAllocate(1000, [
      { id: DN, invoice_number: "SI/DN/26-27/01", invoice_date: "2026-10-10", balance: 590 },
      { id: INV, invoice_number: "SI/INV/26-27/04", invoice_date: "2026-10-01", balance: 300 },
    ]);
    expect(r.lines).toEqual([{ invoiceId: INV, amount: 300 }, { invoiceId: DN, amount: 590 }]);
    expect(r.advance).toBe(110);
  });
});
