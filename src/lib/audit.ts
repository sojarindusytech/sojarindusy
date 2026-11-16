/** Shared, pure audit-log pieces (safe for client and server). */

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

/** Fields never written to the audit trail, even inside a diff. */
const SECRET = /password|token|secret|otp|api[_-]?key|account_no|ifsc/i;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Field-by-field changes between two records: only keys that differ, secrets masked.
 * `fields` limits the comparison (defaults to every key of `after`). Returns null when nothing changed.
 */
export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[]
): AuditChanges | null {
  const b = before ?? {};
  const a = after ?? {};
  const keys = fields ?? Object.keys(a);
  const out: AuditChanges = {};
  for (const k of keys) {
    if (k === "updated_at" || k === "created_at") continue;
    if (same(b[k], a[k])) continue;
    out[k] = SECRET.test(k) ? { from: "••••", to: "••••" } : { from: b[k] ?? null, to: a[k] ?? null };
  }
  return Object.keys(out).length ? out : null;
}

/** Human labels for the audit page filter, grouped by what was touched. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  auth: "Sign-in & password",
  customer: "Customers",
  order: "Orders",
  invoice: "Invoices",
  payment: "Payments received",
  supplier_payment: "Payments made",
  credit_note: "Credit notes",
  debit_note: "Debit notes",
  journal: "Journals",
  ledger_account: "Ledger accounts",
  sales_settings: "Sales settings",
  product: "Products",
  sku: "SKUs",
  stock: "Stock",
  coupon: "Coupons",
  purchase_order: "Purchase orders",
  quote: "Quotes",
  rfq: "RFQs",
  category: "Categories",
  attribute: "Attributes",
  inquiry: "Inquiries",
};
