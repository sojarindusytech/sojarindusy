/**
 * Tests for the payment allocation helpers.
 *   npm test
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { autoAllocate, defaultChannel, modeLabel, validateAllocations } from "../payments";

const inv = (id: string, no: string, date: string, balance: number, order_id: string | null = null) => ({
  id, invoice_number: no, invoice_date: date, balance, order_id,
});

describe("autoAllocate", () => {
  it("fills the oldest invoice first", () => {
    const r = autoAllocate(1000, [inv("b", "INV-2", "2026-05-10", 800), inv("a", "INV-1", "2026-04-02", 500)]);
    assert.deepEqual(r.lines, [{ invoiceId: "a", amount: 500 }, { invoiceId: "b", amount: 500 }]);
    assert.equal(r.advance, 0);
  });

  it("keeps the remainder as advance", () => {
    const r = autoAllocate(1500, [inv("a", "INV-1", "2026-04-02", 500), inv("b", "INV-2", "2026-05-10", 300)]);
    assert.deepEqual(r.lines, [{ invoiceId: "a", amount: 500 }, { invoiceId: "b", amount: 300 }]);
    assert.equal(r.advance, 700);
  });

  it("handles no invoices and a zero amount", () => {
    assert.deepEqual(autoAllocate(100, []), { lines: [], advance: 100 });
    assert.deepEqual(autoAllocate(0, [inv("a", "I", "2026-01-01", 50)]), { lines: [], advance: 0 });
  });

  it("breaks date ties on the invoice number and never drifts by a paisa", () => {
    const r = autoAllocate(0.3, [inv("x", "INV-9", "2026-04-01", 0.1), inv("y", "INV-10", "2026-04-01", 0.2)]);
    assert.deepEqual(r.lines.map((l) => l.invoiceId), ["y", "x"]); // "INV-10" sorts before "INV-9" as text
    const paise = Math.round(r.lines.reduce((s, l) => s + l.amount, 0) * 100) + Math.round(r.advance * 100);
    assert.equal(paise, 30);
  });
});

describe("validateAllocations", () => {
  const ok = { amount: 1000, invoiceLines: [{ invoiceId: "a", amount: 600 }], remainder: 400, balances: { a: 600 } };

  it("accepts a split that adds up", () => {
    assert.deepEqual(validateAllocations(ok), []);
    assert.deepEqual(
      validateAllocations({ amount: 0.3, invoiceLines: [{ invoiceId: "a", amount: 0.1 }], remainder: 0.2, balances: { a: 0.1 } }),
      []
    );
  });

  it("reports a total that does not match", () => {
    assert.match(validateAllocations({ ...ok, remainder: 300 })[0], /Allocations total ₹900\.00 but the amount received is ₹1000\.00/);
  });

  it("refuses more than an invoice balance", () => {
    assert.match(
      validateAllocations({ ...ok, invoiceLines: [{ invoiceId: "a", amount: 700 }], remainder: 300 })[0],
      /More than the balance/
    );
  });

  it("refuses a zero amount, a negative remainder and a repeated invoice", () => {
    assert.ok(validateAllocations({ ...ok, amount: 0, remainder: 0, invoiceLines: [] }).length > 0);
    assert.ok(validateAllocations({ ...ok, remainder: -1 }).some((e) => /more than the amount/i.test(e)));
    assert.ok(
      validateAllocations({ ...ok, invoiceLines: [{ invoiceId: "a", amount: 300 }, { invoiceId: "a", amount: 300 }] }).some((e) => /twice/.test(e))
    );
  });
});

describe("channel and labels", () => {
  it("defaults to eCom for an order's invoice, else follows the customer's channel", () => {
    assert.equal(defaultChannel([inv("a", "I", "2026-01-01", 1, "order-1")], "offline"), "ecom");
    assert.equal(defaultChannel([inv("a", "I", "2026-01-01", 1)], "offline"), "offline");
    assert.equal(defaultChannel([], "online"), "ecom");
    assert.equal(defaultChannel([], undefined), "offline");
  });

  it("labels modes, passing unknown ones through", () => {
    assert.equal(modeLabel("upi"), "UPI");
    assert.equal(modeLabel("mystery"), "mystery");
  });
});
