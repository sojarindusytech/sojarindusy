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

// Exercise the same transaction used by the server, against real PostgreSQL.
describe("credit note stock restoration", () => {
  async function fixture(owner = "invoice", quantities = [3]) {
    await db.db.exec("UPDATE sales_settings SET credit_note_restores_stock=true, credit_note_prefix='CN', credit_note_pad=2");
    const product = randomUUID(), variant = randomUUID(), sku = `CN-${randomUUID()}`;
    await db.db.query("INSERT INTO products(id,title,slug) VALUES ($1,'Credit test',$2)", [product, sku]);
    await db.db.query("INSERT INTO product_variants(id,product_id,sku,list_price,stock_quantity) VALUES ($1,$2,$3,100,10)", [variant, product, sku]);
    const computed = computeInvoice({ items: quantities.map(quantity => ({ name: "Item", sku, quantity, unitPrice: 100, gstRate: 18 })), gstEnabled: true, defaultGstRate: 18, sellerStateCode: "24", placeOfSupplyStateCode: "24" });
    const inv = await db.one(`INSERT INTO invoices(invoice_number,invoice_date,user_id,bill_to,items,totals,total_amount,stock_owner) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [`INV-${randomUUID()}`, day, customer, JSON.stringify({ name: "Customer", address: "Vapi" }), JSON.stringify(computed.lines), JSON.stringify(computed.totals), computed.totals.total, owner]) as unknown as Invoice;
    let orderId: string | null = null;
    if (owner === "invoice") await db.service("SELECT post_invoice_stock($1,$2)", [inv.id, admin]);
    if (owner === "order") {
      const order = await db.one(`INSERT INTO orders(user_id,order_number,total_amount,shipping_address,items) VALUES ($1,$2,354,'Vapi',$3) RETURNING id`,
        [customer, `ORD-${randomUUID()}`, JSON.stringify(quantities.map(quantity => ({ id: variant, sku, quantity, name: "Item", reserved_quantity: 0 })))]);
      orderId = order.id as string;
      await db.db.query("UPDATE invoices SET order_id=$1 WHERE id=$2", [orderId, inv.id]);
      await db.service("SELECT transition_order_status($1,'shipped','{}',$2)", [orderId, admin]);
    }
    return { inv, variant, orderId, stock: async () => (await db.one("SELECT stock_quantity FROM product_variants WHERE id=$1", [variant])).stock_quantity };
  }
  it("restores partial manual-invoice credits once, logs them, and leaves reservations alone", async () => {
    const f = await fixture();
    await db.db.query("UPDATE product_variants SET reserved_quantity=2 WHERE id=$1", [f.variant]);
    expect(await f.stock()).toBe(7);
    const payload = input(f.inv, 1);
    const note = await issue(payload);
    expect(await f.stock()).toBe(8);
    expect(note.stock_returns).toMatchObject([{ variantId: f.variant, quantity: 1 }]);
    await issue(payload);
    expect(await f.stock()).toBe(8);
    await issue(input(f.inv, 2));
    expect(await f.stock()).toBe(10);
    expect((await db.one("SELECT reserved_quantity FROM product_variants WHERE id=$1", [f.variant])).reserved_quantity).toBe(2);
    expect((await db.one("SELECT count(*)::int AS n FROM inventory_logs WHERE reference_id=$1 AND movement_type='CREDIT_NOTE_RESTOCK'", [note.credit_note_number])).n).toBe(1);
  });
  it("honours the setting at issuance without retroactively restocking old notes", async () => {
    const f = await fixture();
    await db.db.exec("UPDATE sales_settings SET credit_note_restores_stock=false");
    const payload = input(f.inv);
    expect((await issue(payload)).stock_returns).toEqual([]);
    expect(await f.stock()).toBe(7);
    await db.db.exec("UPDATE sales_settings SET credit_note_restores_stock=true");
    await issue(payload);
    expect(await f.stock()).toBe(7);
    await issue(input(f.inv));
    expect(await f.stock()).toBe(8);
  });
  it("skips invoices that never deducted stock, including legacy and custom lines", async () => {
    for (const owner of ["none", "legacy"]) {
      const f = await fixture(owner);
      expect((await issue(input(f.inv))).stock_returns).toEqual([]);
      expect(await f.stock()).toBe(10);
    }
    expect((await issue(input(await invoice()))).stock_returns).toEqual([]);
  });
  it("rolls back stock and numbering if the note cannot be inserted", async () => {
    const f = await fixture();
    const before = await db.one("SELECT credit_note_next_number FROM sales_settings");
    await expect(issue({ ...input(f.inv), reason: "" })).rejects.toThrow();
    expect(await f.stock()).toBe(7);
    expect(await db.one("SELECT credit_note_next_number FROM sales_settings")).toEqual(before);
    expect((await db.one("SELECT count(*)::int AS n FROM inventory_logs WHERE variant_id=$1 AND movement_type='CREDIT_NOTE_RESTOCK'", [f.variant])).n).toBe(0);
  });
  it("restores only the outstanding units when a credited order is later returned", async () => {
    const f = await fixture("order");
    await issue(input(f.inv, 1));
    expect(await f.stock()).toBe(8);
    await db.service("SELECT transition_order_status($1,'returned','{}',$2)", [f.orderId, admin]);
    expect(await f.stock()).toBe(10);
    await issue(input(f.inv, 2));
    expect(await f.stock()).toBe(10);
    await db.service("SELECT transition_order_status($1,'returned','{}',$2)", [f.orderId, admin]);
    expect(await f.stock()).toBe(10);
  });
  it("does not restock an order already returned before any credit", async () => {
    const f = await fixture("order");
    await db.service("SELECT transition_order_status($1,'returned','{}',$2)", [f.orderId, admin]);
    expect((await issue(input(f.inv, 3))).stock_returns).toEqual([]);
    expect(await f.stock()).toBe(10);
  });
  it("handles duplicate SKU lines without subtracting the credited balance twice", async () => {
    const f = await fixture("order", [2, 3]);
    expect(await f.stock()).toBe(5);
    await issue(input(f.inv, 2));
    expect(await f.stock()).toBe(7);
    await db.service("SELECT transition_order_status($1,'returned','{}',$2)", [f.orderId, admin]);
    expect(await f.stock()).toBe(10);
  });
  it("reconciles fractional partial credits to the original integer stock deduction", async () => {
    const f = await fixture("invoice", [1.5]);
    expect(await f.stock()).toBe(8);
    for (let i = 0; i < 6; i++) await issue(input(f.inv, 0.25));
    expect(await f.stock()).toBe(10);
  });
  it("keeps the stock deduction linked when the invoice number changes", async () => {
    const f = await fixture();
    await db.db.query("UPDATE invoices SET invoice_number=$1 WHERE id=$2", [`RENAMED-${randomUUID()}`, f.inv.id]);
    await issue(input(f.inv, 3));
    expect(await f.stock()).toBe(10);
  });
  it("never creates stock for a catalogue SKU added after the invoice was posted", async () => {
    const f = await fixture("none");
    await db.db.query("UPDATE invoices SET stock_owner='invoice', stock_posted_at=now() WHERE id=$1", [f.inv.id]);
    await issue(input(f.inv, 3));
    expect(await f.stock()).toBe(10);
  });
  it("cannot restore more than the recorded deduction for duplicate manual SKU lines", async () => {
    const f = await fixture("invoice", [2, 3]);
    await issue({ ...input(f.inv), lines: [{ index: 0, quantity: 2 }, { index: 1, quantity: 3 }] });
    expect(await f.stock()).toBe(10);
  });
});
