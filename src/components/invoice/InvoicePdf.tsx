import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { Invoice, SalesSettings } from "@/types/database.types";
import { normalizeCopies, round2, type InvoiceLine, type TaxSummaryRow } from "@/lib/invoice";
import { documentTerms, termsParagraphs as splitTerms } from "@/lib/document-terms";
import { Money, SellerHeader, fmtDate, fmtPct, s } from "@/components/invoice/pdf-shared";

/**
 * Pure renderer for an issued invoice (a row of `invoices` plus the seller
 * settings). Layout follows the uploaded Sojar tax-invoice format: items, totals, bank
 * details, terms and signature share one page when they fit, else flow onto the next.
 * Fonts, base styles and the seller header live in pdf-shared.tsx.
 */

/** Amount with the percentage underneath, e.g. discount "₹ 308.00 (35.0%)". */
function MoneyPct({ value, pct }: { value: number; pct: number }) {
  return (
    <View>
      <Money value={value} />
      <Text>({fmtPct(pct)})</Text>
    </View>
  );
}

/**
 * Tax rows by the rate actually applied. A debit note's "GST charged too low" line
 * is shown as the value its missing rate was charged on (e.g. ₹1,000 at 3% = ₹30),
 * not as a ₹0 taxable value that wouldn't explain the tax.
 */
function taxSummaryByAppliedRate(items: InvoiceLine[]): TaxSummaryRow[] {
  const byRate = new Map<number, TaxSummaryRow>();
  for (const l of items) {
    const rate = l.taxOnly ? round2(l.gstRate - l.taxOnly.chargedRate) : l.gstRate;
    const row = byRate.get(rate) ?? { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + (l.taxOnly ? l.taxOnly.base : l.taxable));
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    byRate.set(rate, row);
  }
  return [...byRate.values()].sort((a, b) => a.rate - b.rate);
}

interface Col {
  key: string;
  label: string;
  flex: number;
  align?: "left" | "right";
}

/** Present when rendering a quotation: same layout, quotation wording and terms. */
export interface QuoteExtras {
  validUntil: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
}

export interface CreditNoteExtras {
  invoiceNumber: string;
  invoiceDate: string;
  reason: string;
  treatment: "gst" | "commercial";
}

/**
 * Present when rendering a GST debit note: same layout, plus the original invoice's
 * number and date (required by Rule 53(1A)) and the reason.
 */
export interface DebitNoteExtras {
  invoiceNumber: string;
  invoiceDate: string;
  reason: string;
  note?: string | null;
}

export function InvoicePdf({
  invoice,
  settings,
  quote,
  creditNote,
  debitNote,
}: {
  invoice: Invoice;
  settings: SalesSettings;
  quote?: QuoteExtras;
  creditNote?: CreditNoteExtras;
  debitNote?: DebitNoteExtras;
}) {
  const isQuote = !!quote;
  const isDebitNote = !!debitNote;
  const { items, totals, bill_to: billTo } = invoice;
  const gst = invoice.gst_enabled;
  const interState = gst && items.some((l) => l.igst > 0);
  const documentLabel = creditNote ? "Credit Note" : isQuote ? "Quotation" : isDebitNote ? "Debit Note" : "Invoice";
  const title = creditNote ? (creditNote.treatment === "gst" ? "Credit Note" : "Commercial Credit Note") : isQuote ? "Quotation" : isDebitNote ? "Debit Note" : gst ? "Tax Invoice" : "Invoice";

  const cols: Col[] = [
    { key: "idx", label: "#", flex: 0.5, align: "left" },
    { key: "name", label: "Item name", flex: 3.2, align: "left" },
    { key: "hsn", label: "HSN/ SAC", flex: 1.2, align: "left" },
    { key: "qty", label: "Quantity", flex: 1 },
    { key: "unit", label: "Unit", flex: 0.8 },
    { key: "price", label: "Price/ unit", flex: 1.4 },
    // A debit note adds an amount; it never carries a discount.
    ...(isDebitNote ? [] : [{ key: "disc", label: "Discount", flex: 1.5 }]),
    { key: "taxable", label: gst ? "Taxable amount" : "Amount", flex: 1.5 },
    ...(gst
      ? interState
        ? [{ key: "igst", label: "IGST", flex: 1.5 }]
        : [
            { key: "cgst", label: "CGST", flex: 1.4 },
            { key: "sgst", label: "SGST", flex: 1.4 },
          ]
      : []),
    ...(gst ? [{ key: "amount", label: "Amount", flex: 1.6 }] : []),
  ];

  const cell = (col: Col, i: number, last: boolean, content: React.ReactNode, header = false) => (
    <View
      key={col.key}
      style={[
        { flex: col.flex },
        header ? s.th : s.td,
        col.align === "left" ? { textAlign: "left", alignItems: "flex-start" } : { alignItems: "flex-end" },
        !last && !header ? s.cellBorder : {},
        !last && header ? { borderRightWidth: 1, borderRightColor: "#fff" } : {},
      ]}
    >
      {typeof content === "string" ? <Text>{content}</Text> : content}
    </View>
  );

  const lineCell = (key: string, l: (typeof items)[number], idx: number): React.ReactNode => {
    // A debit note's "GST charged too low" line adds no value: only the missing rate is taxed.
    const taxPct = l.taxOnly ? l.gstRate - l.taxOnly.chargedRate : l.gstRate;
    switch (key) {
      case "idx": return String(idx + 1);
      case "name":
        return (
          <View>
            <Text style={s.bold}>{l.name}</Text>
            {l.description ? <Text>{l.description}</Text> : null}
          </View>
        );
      case "hsn": return l.hsn ?? "";
      case "qty": return String(l.quantity);
      case "unit": return l.unit;
      case "price": return l.taxOnly ? "—" : <Money value={l.unitPrice} />;
      case "disc": return <MoneyPct value={l.discountAmount} pct={l.discountPct} />;
      case "taxable": return <Money value={l.taxable} />;
      case "cgst": return <MoneyPct value={l.cgst} pct={taxPct / 2} />;
      case "sgst": return <MoneyPct value={l.sgst} pct={taxPct / 2} />;
      case "igst": return <MoneyPct value={l.igst} pct={taxPct} />;
      case "amount": return <Money value={l.amount} />;
      default: return "";
    }
  };

  const totalCell = (key: string): React.ReactNode => {
    switch (key) {
      case "name": return <Text style={s.bold}>Total</Text>;
      case "qty": return <Text style={s.bold}>{String(totals.quantity)}</Text>;
      case "disc": return <Text style={s.bold}><Money value={totals.discountTotal} /></Text>;
      case "taxable": return <Text style={s.bold}><Money value={totals.taxableTotal} /></Text>;
      case "cgst": return <Text style={s.bold}><Money value={totals.cgstTotal} /></Text>;
      case "sgst": return <Text style={s.bold}><Money value={totals.sgstTotal} /></Text>;
      case "igst": return <Text style={s.bold}><Money value={totals.igstTotal} /></Text>;
      case "amount": return <Text style={s.bold}><Money value={totals.subTotal} /></Text>;
      default: return "";
    }
  };

  const summary = items.some((l) => l.taxOnly) ? taxSummaryByAppliedRate(items) : totals.taxSummary ?? [];
  const taxRows = summary
    .filter((r) => r.rate > 0)
    .flatMap((r) =>
      interState
        ? [{ type: "IGST", taxable: r.taxable, rate: r.rate, tax: r.igst }]
        : [
            { type: "SGST", taxable: r.taxable, rate: r.rate / 2, tax: r.sgst },
            { type: "CGST", taxable: r.taxable, rate: r.rate / 2, tax: r.cgst },
          ]
    );

  // Quotations, credit notes and debit notes have no ORIGINAL/DUPLICATE marking.
  const copies = isQuote || creditNote || isDebitNote ? [""] : normalizeCopies(settings.invoice_copies);
  const termsParagraphs = [
    ...(quote?.paymentTerms ? [`Payment Terms: ${quote.paymentTerms}`] : []),
    ...(quote?.deliveryTerms ? [`Delivery Terms: ${quote.deliveryTerms}`] : []),
    ...(quote ? [`This quotation is valid until ${fmtDate(quote.validUntil)}.`] : []),
    ...(creditNote ? [creditNote.treatment === "commercial" ? "Commercial credit only. No adjustment to GST liability." : "GST adjustment against the referenced invoice.", "This document records a credit. It is not a payment or refund receipt."] : []),
    ...splitTerms(documentTerms(settings, creditNote ? "credit_note" : isQuote ? "quote" : isDebitNote ? "debit_note" : "invoice")),
  ];

  return (
    <Document title={`${title} ${invoice.invoice_number}`} author={settings.company_name}>
      {copies.map((copy) => (
      <Page key={copy || "single"} size="A4" style={s.page}>
        <View fixed>
          <SellerHeader settings={settings} tag={title} copy={copy} />
        </View>

        <View style={s.split}>
          <View style={[s.half, { borderRightWidth: 0 }]}>
            <Text style={s.bar}>Bill To</Text>
            <View style={s.halfPad}>
              <Text style={[s.bold, { marginBottom: 3 }]}>{billTo.name}</Text>
              {billTo.address ? <Text style={{ marginBottom: 3 }}>{billTo.address}</Text> : null}
              {billTo.contact ? <Text style={{ marginBottom: 3 }}>Contact No.: {billTo.contact}</Text> : null}
              {billTo.gstin ? <Text style={{ marginBottom: 3 }}>GSTIN Number: {billTo.gstin}</Text> : null}
              {billTo.state ? <Text>State: {billTo.state}</Text> : null}
            </View>
          </View>
          <View style={s.half}>
            <Text style={[s.bar, { textAlign: "right" }]}>{documentLabel} Details</Text>
            <View style={[s.halfPad, { alignItems: "flex-end" }]}>
              <Text style={{ marginBottom: 3 }}>{documentLabel} No.: {invoice.invoice_number}</Text>
              <Text style={{ marginBottom: 3 }}>Date: {fmtDate(invoice.invoice_date)}</Text>
              {creditNote ? <><Text style={{ marginBottom: 3 }}>Original Invoice: {creditNote.invoiceNumber}</Text><Text style={{ marginBottom: 3 }}>Invoice Date: {fmtDate(creditNote.invoiceDate)}</Text></> : null}
              {quote ? <Text style={{ marginBottom: 3 }}>Valid Until: {fmtDate(quote.validUntil)}</Text> : null}
              {debitNote ? (
                <>
                  <Text style={{ marginBottom: 3 }}>Against Invoice No.: {debitNote.invoiceNumber}</Text>
                  <Text style={{ marginBottom: 3 }}>Invoice Date: {fmtDate(debitNote.invoiceDate)}</Text>
                  <Text style={{ marginBottom: 3, textAlign: "right" }}>
                    Reason: {debitNote.reason}{debitNote.note ? ` (${debitNote.note})` : ""}
                  </Text>
                </>
              ) : null}
              {invoice.place_of_supply ? <Text style={{ marginBottom: 3 }}>Place of Supply: {invoice.place_of_supply}</Text> : null}
              {invoice.po_number ? <Text>PO number: {invoice.po_number}</Text> : null}
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.row}>{cols.map((c, i) => cell(c, i, i === cols.length - 1, c.label, true))}</View>
        <View style={s.tableBody}>
          {items.map((l, idx) => (
            <View key={idx} style={[s.row, s.rowBorder]} wrap={false}>
              {cols.map((c, i) => cell(c, i, i === cols.length - 1, lineCell(c.key, l, idx)))}
            </View>
          ))}
          <View style={s.row}>{cols.map((c, i) => cell(c, i, i === cols.length - 1, totalCell(c.key)))}</View>
        </View>

        {/* Tax summary + amounts */}
        <View style={s.bottom} wrap={false}>
          <View style={s.left}>
            {creditNote ? (
              <Text style={{ padding: 4, lineHeight: 1.35 }}>
                <Text style={s.bold}>Reason: </Text>{creditNote.reason}
              </Text>
            ) : null}
            {gst ? (
              <>
                <View style={s.row}>
                  <Text style={[s.th, { flex: 1, textAlign: "left" }]}>Tax type</Text>
                  <Text style={[s.th, { flex: 1.3 }]}>Taxable amount</Text>
                  <Text style={[s.th, { flex: 0.8 }]}>Rate</Text>
                  <Text style={[s.th, { flex: 1.2 }]}>Tax amount</Text>
                </View>
                {taxRows.map((r, i) => (
                  <View key={i} style={s.row}>
                    <Text style={[s.td, { flex: 1, textAlign: "left" }]}>{r.type}</Text>
                    <View style={[s.td, { flex: 1.3 }]}><Money value={r.taxable} /></View>
                    <Text style={[s.td, { flex: 0.8 }]}>{fmtPct(r.rate)}</Text>
                    <View style={[s.td, { flex: 1.2 }]}><Money value={r.tax} /></View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
          <View style={s.right}>
            <Text style={[s.bar, { textAlign: "left" }]}>Amounts</Text>
            <View style={s.amountRow}><Text>Sub Total</Text><Money value={totals.subTotal} /></View>
            <View style={[s.amountRow, s.rowBorder]}><Text>Round off</Text><Money value={totals.roundOff} /></View>
            <View style={[s.amountRow, s.rowBorder, s.bold]}><Text style={s.bold}>{creditNote ? "Total Credit" : "Total"}</Text><Text style={s.bold}><Money value={totals.total} /></Text></View>
            {!creditNote && totals.youSaved > 0 ? (
              <View style={s.amountRow}><Text>You Saved</Text><Money value={totals.youSaved} /></View>
            ) : null}
          </View>
        </View>

        <View style={[s.box, { borderTopWidth: 0 }]} wrap={false}>
          <Text style={[s.bar, { textAlign: "center" }]}>{documentLabel} Amount In Words</Text>
          <Text style={{ padding: 4 }}>{invoice.amount_in_words}</Text>
        </View>

        {/* Bank / terms / signature: same page when it fits, otherwise flows to the next page (header repeats). */}
        <View style={s.split} wrap={false}>
          <View style={[s.half, { borderRightWidth: 0 }]}>
            <Text style={s.bar}>Bank Details</Text>
            <View style={s.halfPad}>
              {settings.bank_name ? <Text style={{ marginBottom: 3 }}>Name: {settings.bank_name}{settings.bank_address ? ` ADDRESS: ${settings.bank_address}` : ""}</Text> : null}
              {settings.account_no ? <Text style={{ marginBottom: 3 }}>Account No.: {settings.account_no}</Text> : null}
              {settings.ifsc ? <Text style={{ marginBottom: 3 }}>IFSC code: {settings.ifsc}</Text> : null}
              {settings.account_holder ? <Text>Account Holder&apos;s Name: {settings.account_holder}</Text> : null}
            </View>
          </View>
          {termsParagraphs.length > 0 ? (
            <View style={[s.half, { borderRightWidth: 0 }]}>
              <Text style={s.bar}>Terms and conditions</Text>
              <View style={s.halfPad}>
                {termsParagraphs.map((p, i) => (
                  <Text key={i} style={{ marginBottom: 6 }}>{p}</Text>
                ))}
              </View>
            </View>
          ) : null}
          <View style={[s.half, { alignItems: "center", padding: 4 }]}>
            <Text>For: {settings.company_name}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {settings.signature_url ? <Image src={settings.signature_url} style={s.sig} /> : <View style={{ height: 54 }} />}
            <Text style={s.bold}>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
      ))}
    </Document>
  );
}
