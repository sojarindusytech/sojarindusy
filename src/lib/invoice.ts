/**
 * Pure invoice maths: line/tax/total computation, amount in words, financial
 * year and invoice-number formatting. No I/O so it is shared by the server
 * actions, the manual-invoice form (live totals) and the PDF renderer.
 */

export interface InvoiceLineInput {
  name: string;
  sku?: string | null;
  description?: string | null;
  hsn?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  /** Discount percentage on the line (0-100). */
  discountPct?: number | null;
  /**
   * Exact discount in rupees (e.g. a coupon share carried over from an order).
   * When set it wins over discountPct, so the invoice reproduces the order to
   * the paisa; the printed percentage is derived from it.
   */
  discountAmount?: number | null;
  /** GST % for this line. Ignored (treated as 0) when GST billing is off. */
  gstRate?: number | null;
  /**
   * Debit note for GST charged too low: the line adds no value, only tax.
   * Its taxable amount is 0 and its tax is `base` x (gstRate - chargedRate)%,
   * where gstRate is the rate that was due. unitPrice and discounts are ignored.
   */
  taxOnly?: TaxOnlyAdjustment | null;
}

/** The invoice line value and the rate it was wrongly charged at. */
export interface TaxOnlyAdjustment {
  base: number;
  chargedRate: number;
}

export interface InvoiceLine {
  name: string;
  sku: string | null;
  description: string | null;
  hsn: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  taxable: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
  /** Present on an "extra GST only" line (see InvoiceLineInput.taxOnly). */
  taxOnly?: TaxOnlyAdjustment;
}

export interface TaxSummaryRow {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface InvoiceTotals {
  quantity: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  /** Sum of line amounts before rounding. */
  subTotal: number;
  roundOff: number;
  total: number;
  /** Discount including the GST that would have applied on it. */
  youSaved: number;
  taxSummary: TaxSummaryRow[];
}

export interface ComputedInvoice {
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  /** true when CGST+SGST apply, false when IGST applies (inter-state). */
  intraState: boolean;
}

export interface ComputeInvoiceInput {
  items: InvoiceLineInput[];
  gstEnabled: boolean;
  /** Fallback for lines without their own rate. */
  defaultGstRate: number;
  sellerStateCode: string | null | undefined;
  placeOfSupplyStateCode: string | null | undefined;
}

/** Copy labels printed top-right of each invoice page set (GST rule 46: recipient / transporter / supplier). */
export const INVOICE_COPIES = ["original", "duplicate", "triplicate"] as const;
export type InvoiceCopy = (typeof INVOICE_COPIES)[number];

/** Canonical order, de-duplicated, never empty (falls back to Original). */
export function normalizeCopies(input: readonly string[] | null | undefined): InvoiceCopy[] {
  const picked = INVOICE_COPIES.filter((c) => input?.includes(c));
  return picked.length ? picked : ["original"];
}

/** GST slabs offered in dropdowns (settings default, per-SKU rate). */
export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28, 40] as const;

/** HSN/SAC codes are 4-8 digits. Blank is allowed (prints empty on the invoice). */
export function normalizeHsn(input: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  const v = (input ?? "").trim();
  if (v === "") return { ok: true, value: null };
  return /^\d{4,8}$/.test(v) ? { ok: true, value: v } : { ok: false };
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** "24-Gujarat" -> "24". */
export function stateCodeOf(placeOfSupply: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\b/.exec(placeOfSupply ?? "");
  return m ? m[1].padStart(2, "0") : null;
}

/** SKU rate wins; blank/NaN falls back to the settings default. */
export function resolveGstRate(skuRate: number | null | undefined, defaultRate: number): number {
  return skuRate === null || skuRate === undefined || Number.isNaN(skuRate) ? defaultRate : skuRate;
}

export function computeInvoice(input: ComputeInvoiceInput): ComputedInvoice {
  const { gstEnabled, defaultGstRate } = input;
  const seller = input.sellerStateCode ? input.sellerStateCode.padStart(2, "0") : null;
  const supply = input.placeOfSupplyStateCode ? input.placeOfSupplyStateCode.padStart(2, "0") : null;
  // Unknown on either side: assume intra-state (CGST+SGST) rather than guessing IGST.
  const intraState = !seller || !supply || seller === supply;

  const lines: InvoiceLine[] = input.items.map((it) => {
    const taxOnly: TaxOnlyAdjustment | null =
      it.taxOnly && gstEnabled
        ? {
            base: Math.max(0, round2(Number(it.taxOnly.base) || 0)),
            chargedRate: clamp(Number(it.taxOnly.chargedRate) || 0, 0, 100),
          }
        : null;
    const quantity = Math.max(0, Number(it.quantity) || 0);
    // A tax-only line never adds value, even when GST billing is off (then it adds nothing).
    const unitPrice = it.taxOnly ? 0 : Math.max(0, Number(it.unitPrice) || 0);
    const gross = round2(quantity * unitPrice);
    const fixedDiscount =
      it.discountAmount === null || it.discountAmount === undefined
        ? null
        : clamp(round2(Number(it.discountAmount) || 0), 0, gross);
    const discountPct =
      fixedDiscount === null
        ? clamp(Number(it.discountPct) || 0, 0, 100)
        : gross > 0
          ? round2((fixedDiscount / gross) * 100)
          : 0;
    const discountAmount = fixedDiscount ?? round2((gross * discountPct) / 100);
    const taxable = round2(gross - discountAmount);
    const gstRate = gstEnabled ? clamp(resolveGstRate(it.gstRate, defaultGstRate), 0, 100) : 0;
    // A tax-only line charges just the missing rate on the original value.
    const taxBase = taxOnly ? taxOnly.base : taxable;
    const taxRate = taxOnly ? Math.max(0, gstRate - taxOnly.chargedRate) : gstRate;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (taxRate > 0) {
      if (intraState) {
        cgst = round2((taxBase * taxRate) / 200);
        sgst = round2((taxBase * taxRate) / 200);
      } else {
        igst = round2((taxBase * taxRate) / 100);
      }
    }

    return {
      name: it.name,
      sku: it.sku ?? null,
      description: it.description ?? null,
      hsn: it.hsn ?? null,
      quantity,
      unit: it.unit || "Pcs",
      unitPrice,
      discountPct,
      discountAmount,
      taxable,
      gstRate,
      cgst,
      sgst,
      igst,
      amount: round2(taxable + cgst + sgst + igst),
      ...(taxOnly ? { taxOnly } : {}),
    };
  });

  const sum = (pick: (l: InvoiceLine) => number) => round2(lines.reduce((acc, l) => acc + pick(l), 0));
  const subTotal = sum((l) => l.amount);
  const total = Math.round(subTotal);

  const byRate = new Map<number, TaxSummaryRow>();
  for (const l of lines) {
    const row = byRate.get(l.gstRate) ?? { rate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + l.taxable);
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    byRate.set(l.gstRate, row);
  }

  return {
    lines,
    intraState,
    totals: {
      quantity: sum((l) => l.quantity),
      discountTotal: sum((l) => l.discountAmount),
      taxableTotal: sum((l) => l.taxable),
      cgstTotal: sum((l) => l.cgst),
      sgstTotal: sum((l) => l.sgst),
      igstTotal: sum((l) => l.igst),
      subTotal,
      roundOff: round2(total - subTotal),
      total,
      youSaved: sum((l) => l.discountAmount * (1 + l.gstRate / 100)),
      taxSummary: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    },
  };
}

// ---------------------------------------------------------------------------
// Amount in words (Indian numbering: thousand, lakh, crore)
// ---------------------------------------------------------------------------

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const below100 = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;

function integerInWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore) parts.push(`${integerInWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(`${n >= 100 ? "and " : ""}${below100(rest)}`);
  return parts.join(" ");
}

/** 8330 -> "Eight Thousand Three Hundred and Thirty Rupees only". */
export function amountInWords(amount: number): string {
  const safe = Math.max(0, round2(Number.isFinite(amount) ? amount : 0));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  let out = `${integerInWords(rupees)} Rupees`;
  if (paise) out += ` and ${below100(paise)} Paise`;
  return `${out} only`;
}

// ---------------------------------------------------------------------------
// Financial year + invoice numbers
// ---------------------------------------------------------------------------

/** Indian financial year (April-March) of a moment, evaluated in IST: "25-26". */
export function financialYear(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() < 3 ? year - 1 : year;
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
}

/** formatInvoiceNumber("SI/INV", "25-26", 4, 2) -> "SI/INV/25-26/04". */
export function formatInvoiceNumber(prefix: string, fy: string, seq: number, pad: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(pad, "0")}`;
}
