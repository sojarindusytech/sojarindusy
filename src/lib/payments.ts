/**
 * Pure payment helpers shared by the Record Payment form (live checks), the server action and tests.
 * Amounts are handled in paise internally so splitting a payment never drifts by a fraction of a rupee.
 */

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer (NEFT / RTGS / IMPS)" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card (POS)" },
  { value: "net_banking", label: "Net Banking" },
  { value: "demand_draft", label: "Demand Draft" },
  { value: "wallet", label: "Wallet" },
  { value: "payment_gateway", label: "Online Payment Gateway" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

export const PAYMENT_CHANNELS = [
  { value: "ecom", label: "eCom" },
  { value: "offline", label: "Offline / POS" },
] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number]["value"];

export type PaymentStatus = "received" | "cancelled";
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid" | "cancelled";

export const modeLabel = (mode: string): string => PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode;

/** Rupees to whole paise and back. */
export const toPaise = (rupees: number): number => Math.round((Number(rupees) || 0) * 100);
export const fromPaise = (paise: number): number => paise / 100;

/**
 * A document that still has money due: an invoice, or a debit note (which adds to what the
 * customer owes on an invoice). For a debit note, invoice_number / invoice_date hold the
 * debit note's own number and date.
 */
export interface OpenInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  balance: number;
  order_id: string | null;
  /** Absent = invoice. */
  kind?: "invoice" | "debit_note";
}

/** How an allocation is shown in lists and on the receipt. */
export function allocationLabel(a: {
  kind: string;
  invoice_number?: string | null;
  debit_note_number?: string | null;
  note?: string | null;
}): string {
  if (a.kind === "invoice") return a.invoice_number ?? "Invoice";
  if (a.kind === "debit_note") return `Debit note ${a.debit_note_number ?? ""}`.trim();
  if (a.kind === "advance") return "Advance";
  return a.note ? `Other (${a.note})` : "Other";
}

export interface AllocationInput {
  invoiceId: string;
  amount: number;
}

/**
 * Oldest invoice first (then by number), each filled up to its balance; whatever is left is the advance.
 * Never allocates more than `amount` or more than a balance.
 */
export function autoAllocate(amount: number, invoices: Pick<OpenInvoice, "id" | "invoice_number" | "invoice_date" | "balance">[]) {
  let left = toPaise(amount);
  const lines: AllocationInput[] = [];
  const ordered = [...invoices].sort(
    (a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.invoice_number.localeCompare(b.invoice_number)
  );
  for (const inv of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, toPaise(inv.balance));
    if (take > 0) {
      lines.push({ invoiceId: inv.id, amount: fromPaise(take) });
      left -= take;
    }
  }
  return { lines, advance: fromPaise(left) };
}

export interface AllocationCheck {
  amount: number;
  invoiceLines: AllocationInput[];
  /** Remainder kept as advance / other. */
  remainder: number;
  balances: Record<string, number>;
}

/** Human-readable problems with a draft split; empty when it can be submitted. */
export function validateAllocations({ amount, invoiceLines, remainder, balances }: AllocationCheck): string[] {
  const errors: string[] = [];
  if (!(toPaise(amount) > 0)) errors.push("Enter the amount received.");
  if (toPaise(remainder) < 0) errors.push("Allocated more than the amount received.");

  let allocated = toPaise(remainder);
  const seen = new Set<string>();
  for (const l of invoiceLines) {
    const paise = toPaise(l.amount);
    if (paise <= 0) continue;
    if (seen.has(l.invoiceId)) errors.push("An invoice appears twice.");
    seen.add(l.invoiceId);
    const balance = toPaise(balances[l.invoiceId] ?? 0);
    if (paise > balance) errors.push(`More than the balance on an invoice (balance ₹${fromPaise(balance).toFixed(2)}).`);
    allocated += paise;
  }
  if (allocated !== toPaise(amount)) {
    errors.push(`Allocations total ₹${fromPaise(allocated).toFixed(2)} but the amount received is ₹${fromPaise(toPaise(amount)).toFixed(2)}.`);
  }
  return errors;
}

/**
 * Channel to preselect: payments against an order's invoice came through eCom; otherwise follow the
 * customer's own channel (online customers = eCom, offline = Offline/POS). The admin can override.
 */
export function defaultChannel(
  selected: Pick<OpenInvoice, "order_id">[],
  customerChannel: string | null | undefined
): PaymentChannel {
  if (selected.some((i) => i.order_id)) return "ecom";
  return customerChannel === "online" ? "ecom" : "offline";
}

export function paymentStatusLabel(status: InvoicePaymentStatus): string {
  return { unpaid: "Unpaid", partial: "Partially Paid", paid: "Paid", cancelled: "Cancelled" }[status];
}
