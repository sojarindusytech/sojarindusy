import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { computeInvoice, financialYear } from "@/lib/invoice";
import { computeCreditNote, type CreditNote, type CreditNoteInput } from "@/lib/credit-note";
import type { Invoice } from "@/types/database.types";
import { createTestDb, type TestDb } from "./test-db";

let db: TestDb;
const admin = randomUUID(), customer = randomUUID(), other = randomUUID();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fy = financialYear();
async function invoice(price = 100, quantity = 10, interstate = false) {
  const computed = computeInvoice({ items: [{ name: "End mill", quantity, unitPrice: price, discountAmount: 3.01, gstRate: 18 }], gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: interstate ? "27" : "24" });
  return await db.one(`INSERT INTO invoices(invoice_number,invoice_date,user_id,bill_to,items,totals,total_amount) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [`INV-${randomUUID()}`, day, customer, JSON.stringify({ name: "Customer A", address: "Vapi" }), JSON.stringify(computed.lines), JSON.stringify(computed.totals), computed.totals.total]) as unknown as Invoice;
}
function input(inv: Invoice, quantity = 1, manualNumber: string | null = null): CreditNoteInput {
  return { invoiceId: inv.id, requestId: randomUUID(), date: day, reason: "Damaged goods returned", treatment: "gst", manualNumber, lines: [{ index: 0, quantity }] };
}
async function issue(payload: CreditNoteInput, actor = admin) {
  const row = await db.service("SELECT to_jsonb(public.issue_credit_note($1::jsonb,$2::uuid)) AS note", [JSON.stringify(payload), actor]);
  return row.note as CreditNote;
}
async function resetCounter(seq = 1, storedFy: string | null = fy, prefix = "CN") {
  await db.db.query("UPDATE sales_settings SET credit_note_prefix=$1,credit_note_pad=2,credit_note_next_number=$2,credit_note_fy=$3", [prefix,seq,storedFy]);
}

beforeAll(async () => {
  db = await createTestDb({ applyNew: true });
  expect(db.applied).toContain("20261016_credit_notes.sql");
  for (const [id, role] of [[admin,"admin"],[customer,"customer"],[other,"customer"]]) {
    await db.db.query("INSERT INTO auth.users(id,email) VALUES ($1,$2)", [id, `${id}@test.in`]);
    await db.db.query("INSERT INTO profiles(id,email,role,approval_status,company_name) VALUES ($1,$2,$3,'approved','Test company') ON CONFLICT (id) DO UPDATE SET role=$3", [id,`${id}@test.in`,role]);
  }
});
afterAll(async () => { await db?.db.close(); });

describe("credit note issuance and numbering", () => {
  it("manual numbers do not move the counter; auto skips occupied numbers; retries return the same note", async () => {
    await resetCounter(1, fy, "CN");
    const inv = await invoice();
    const manual = input(inv, 1, `CN/${fy}/01`);
    const first = await issue(manual);
    expect(first.numbering_mode).toBe("manual");
    expect(first.seq).toBeNull();
    expect((await db.one("SELECT credit_note_next_number FROM sales_settings")).credit_note_next_number).toBe(1);
    const payload = input(inv);
    const second = await issue(payload);
    expect(second.credit_note_number).toBe(`CN/${fy}/02`);
    expect((await issue(payload)).id).toBe(second.id);
    expect((await db.one("SELECT credit_note_next_number FROM sales_settings")).credit_note_next_number).toBe(3);
    await expect(issue(input(inv, 1, first.credit_note_number))).rejects.toThrow("already exists");
  });
  it("resets on a financial-year rollover and never truncates numbers beyond the padding", async () => {
    await resetCounter(88, "00-01", "FY");
    expect((await issue(input(await invoice()))).credit_note_number).toBe(`FY/${fy}/01`);
    await resetCounter(100, fy, "FY");
    expect((await issue(input(await invoice()))).credit_note_number).toBe(`FY/${fy}/100`);
  });
  it("rolls back failed issuance without consuming a number", async () => {
    await resetCounter(10, fy, "ERR");
    const inv = await invoice();
    await expect(issue({ ...input(inv), reason: "" })).rejects.toThrow();
    expect((await db.one("SELECT credit_note_next_number FROM sales_settings")).credit_note_next_number).toBe(10);
    await expect(issue(input(inv, 11))).rejects.toThrow("remaining creditable");
    await expect(issue({ ...input(inv), lines: [{ index: 0, quantity: 1 }, { index: 0, quantity: 1 }] })).rejects.toThrow("Invalid invoice line");
    await expect(issue(input(inv, 1, "BAD_NUMBER"))).rejects.toThrow("1-16");
  });
  it("rejects overflow instead of silently generating an invalid number", async () => {
    await resetCounter(1000, fy, "LONG/CN");
    await expect(issue(input(await invoice()))).rejects.toThrow("exceeds 16");
    await resetCounter(1, fy, "C");
  });
  it("multiple partial credits exactly reconcile original discounts, taxes and round-off", async () => {
    // Sweep both positive and negative invoice round-off, including half-paisa allocations.
    for (const price of [10.01, 10.02, 10.05, 10.13, 10.25, 10.33]) {
      const inv = await invoice(price, 3, true);
      const notes: CreditNote[] = [];
      for (let i = 0; i < 3; i++) {
        const payload = input(inv);
        const preview = computeCreditNote(inv, notes, payload.lines, "gst");
        const note = await issue(payload);
        expect(note.totals).toEqual(preview.totals);
        notes.push(note);
      }
      expect(Math.round(notes.reduce((s,n) => s+n.total_amount,0)*100)).toBe(inv.total_amount*100);
      for (const field of ["taxableTotal","cgstTotal","sgstTotal","igstTotal","discountTotal"] as const) {
        expect(Math.round(notes.reduce((s,n) => s+n.totals[field],0)*100)).toBe(Math.round(inv.totals[field]*100));
      }
      await expect(issue(input(inv))).rejects.toThrow("remaining creditable");
    }
  });
  it("commercial credits preserve the credit value without reversing GST", async () => {
    const inv = await invoice();
    const note = await issue({ ...input(inv,10), treatment: "commercial" });
    expect(note.total_amount).toBe(Number(inv.total_amount));
    expect(note.totals.cgstTotal+note.totals.sgstTotal+note.totals.igstTotal).toBe(0);
    expect(note.items[0].gstRate).toBe(0);
  });
  it("freezes credited invoices and issued notes; seller details stay snapshotted", async () => {
    const inv = await invoice();
    const note = await issue(input(inv));
    await expect(db.db.query("UPDATE invoices SET status='cancelled' WHERE id=$1", [inv.id])).rejects.toThrow("cannot be changed");
    await expect(db.db.query("UPDATE credit_notes SET reason='Changed reason' WHERE id=$1", [note.id])).rejects.toThrow("immutable");
    await expect(db.db.query("DELETE FROM credit_notes WHERE id=$1", [note.id])).rejects.toThrow("immutable");
    await db.db.exec("UPDATE sales_settings SET company_name='Changed company'");
    const row = await db.one("SELECT seller_snapshot FROM credit_notes WHERE id=$1", [note.id]);
    expect(row.seller_snapshot).toEqual(note.seller_snapshot);
  });
  it("denies customer writes and limits reads to the document owner", async () => {
    const inv = await invoice();
    const note = await issue(input(inv));
    await expect(issue(input(inv), customer)).rejects.toThrow("Administrator access");
    await expect(db.as("authenticated", customer, (tx) => tx.query("SELECT issue_credit_note($1::jsonb,$2)", [JSON.stringify(input(inv)),admin]))).rejects.toThrow("permission denied");
    await expect(db.as("authenticated", customer, (tx) => tx.query("DELETE FROM credit_notes WHERE id=$1", [note.id]))).rejects.toThrow("permission denied");
    expect(await db.as("authenticated", customer, async (tx) => (await tx.query("SELECT id FROM credit_notes WHERE id=$1",[note.id])).rows.length)).toBe(1);
    expect(await db.as("authenticated", other, async (tx) => (await tx.query("SELECT id FROM credit_notes WHERE id=$1",[note.id])).rows.length)).toBe(0);
    await expect(db.as("anon", null, (tx) => tx.query("SELECT * FROM credit_notes"))).rejects.toThrow("permission denied");
  });
  it("rejects cancelled invoices and dates outside the invoice-to-today interval", async () => {
    const inv = await invoice();
    await expect(issue({ ...input(inv), date: "2000-01-01" })).rejects.toThrow("between");
    await db.db.query("UPDATE invoices SET status='cancelled' WHERE id=$1", [inv.id]);
    await expect(issue(input(inv))).rejects.toThrow("Only issued invoices");
  });
});
