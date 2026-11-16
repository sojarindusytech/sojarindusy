import { describe, expect, it } from "vitest";
import { collectionsByMode, gstSummary, monthlySales, topCustomers, topProducts, type ReportInvoice, type ReportNote } from "../reports";

const inv = (date: string, user: string | null, name: string, total: number, items: ReportInvoice["items"] = []): ReportInvoice => ({
  invoice_date: date,
  user_id: user,
  bill_to: { name, gstin: user ? `GST-${user}` : null },
  items,
  totals: { taxableTotal: total / 1.18, cgstTotal: (total - total / 1.18) / 2, sgstTotal: (total - total / 1.18) / 2, igstTotal: 0, total },
  total_amount: total,
});
const note = (date: string, user: string | null, name: string, total: number): ReportNote => ({
  date, user_id: user, bill_to: { name },
  totals: { taxableTotal: total / 1.18, cgstTotal: 0, sgstTotal: 0, igstTotal: total - total / 1.18 },
  total_amount: total,
});

const invoices = [
  inv("2026-04-05", "a", "Acme", 1180, [
    { name: "End mill 6mm", sku: "EM6", quantity: 10, taxable: 1000, amount: 1180 },
  ]),
  inv("2026-04-20", "b", "Bolt Co", 2360, [
    { name: "End mill 6mm", sku: "EM6", quantity: 5, taxable: 500, amount: 590 },
    { name: "Drill 8mm", sku: "DR8", quantity: 3, taxable: 1500, amount: 1770 },
  ]),
  inv("2026-05-02", "a", "Acme", 590),
];
const credits = [note("2026-05-10", "a", "Acme", 118)];
const debits = [note("2026-05-11", "b", "Bolt Co", 59)];

describe("monthlySales", () => {
  it("groups by month, net = invoiced − credited + debited", () => {
    expect(monthlySales(invoices, credits, debits)).toEqual([
      { month: "2026-04", invoiced: 3540, credited: 0, debited: 0, net: 3540, invoices: 2 },
      { month: "2026-05", invoiced: 590, credited: 118, debited: 59, net: 531, invoices: 1 },
    ]);
  });
});

describe("gstSummary", () => {
  it("subtracts credit notes and adds debit notes", () => {
    const rows = gstSummary(invoices, credits, debits);
    expect(rows.map((r) => r.label)).toEqual(["Invoices", "Debit notes", "Credit notes", "Net"]);
    expect(rows[2].total).toBe(-118);
    expect(rows[3].total).toBe(4130 + 59 - 118);
  });
});

describe("topCustomers", () => {
  it("ranks by net sales with share of total", () => {
    const rows = topCustomers(invoices, credits, debits);
    expect(rows.map((r) => [r.name, r.net, r.invoices])).toEqual([["Bolt Co", 2419, 1], ["Acme", 1652, 2]]);
    expect(rows[0].share + rows[1].share).toBeCloseTo(100, 1);
  });

  it("groups walk-in customers (no account) by name", () => {
    const rows = topCustomers([inv("2026-04-01", null, "Cash Buyer", 100), inv("2026-04-02", null, " cash buyer ", 50)], [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].net).toBe(150);
  });
});

describe("topProducts", () => {
  it("adds quantity and taxable per SKU and counts invoices once each", () => {
    expect(topProducts(invoices)).toEqual([
      { key: "sku:EM6", sku: "EM6", name: "End mill 6mm", quantity: 15, taxable: 1500, invoices: 2 },
      { key: "sku:DR8", sku: "DR8", name: "Drill 8mm", quantity: 3, taxable: 1500, invoices: 1 },
    ]);
  });
});

describe("collectionsByMode", () => {
  it("totals per mode, biggest first", () => {
    expect(collectionsByMode([
      { payment_date: "2026-04-01", amount: 100, mode: "upi" },
      { payment_date: "2026-04-02", amount: "250.5", mode: "neft" },
      { payment_date: "2026-04-03", amount: 50, mode: "upi" },
    ])).toEqual([{ mode: "neft", amount: 250.5, count: 1 }, { mode: "upi", amount: 150, count: 2 }]);
  });
});
