import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Invoice, SalesSettings } from "@/types/database.types";
import { normalizeCopies } from "@/lib/invoice";

/**
 * Pure renderer for an issued invoice (a row of `invoices` plus the seller
 * settings). Layout follows the uploaded Sojar tax-invoice format: items, totals, bank
 * details, terms and signature share one page when they fit, else flow onto the next.
 * Server-only: fonts are read from disk by react-pdf.
 */

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
// Roboto's latin subset has no rupee sign; the latin-ext subset does. Register
// it as a second family used only for the ₹ glyph (see <Money>).
Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(FONT_DIR, "roboto-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "roboto-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "RobotoExt",
  fonts: [
    { src: path.join(FONT_DIR, "roboto-latin-ext-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "roboto-latin-ext-700-normal.woff"), fontWeight: 700 },
  ],
});
// Never hyphenate item names / SKUs mid-word.
Font.registerHyphenationCallback((word) => [word]);

const ACCENT = "#00B0F0";
const BORDER = "#8A8A8A";

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 28, fontFamily: "Roboto", fontSize: 8, color: "#111" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  topTitle: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, marginLeft: 50 },
  topTag: { width: 50, textAlign: "right", fontSize: 8, color: "#6B7280" },
  box: { borderWidth: 1, borderColor: BORDER },
  header: { flexDirection: "row", padding: 6, borderWidth: 1, borderColor: BORDER },
  logoWrap: { width: 110, justifyContent: "center" },
  logo: { width: 100, height: 52, objectFit: "contain" },
  seller: { flex: 1, alignItems: "flex-end" },
  sellerName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  sellerLine: { fontSize: 8, lineHeight: 1.35, textAlign: "right" },
  bar: { backgroundColor: ACCENT, color: "#fff", fontWeight: 700, paddingVertical: 3, paddingHorizontal: 4 },
  split: { flexDirection: "row" },
  half: { flex: 1, borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
  halfPad: { padding: 4 },
  row: { flexDirection: "row" },
  th: { backgroundColor: ACCENT, color: "#fff", fontWeight: 700, paddingVertical: 4, paddingHorizontal: 3, textAlign: "right" },
  td: { paddingVertical: 4, paddingHorizontal: 3, textAlign: "right", justifyContent: "center" },
  cellBorder: { borderRightWidth: 1, borderRightColor: BORDER },
  tableBody: { borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  bottom: { flexDirection: "row" },
  left: { flex: 1, borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
  right: { flex: 1, borderWidth: 1, borderColor: BORDER, borderTopWidth: 0, borderLeftWidth: 0 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 4 },
  bold: { fontWeight: 700 },
  rs: { fontFamily: "RobotoExt" },
  sig: { width: 90, height: 48, objectFit: "contain", marginTop: 6 },
});

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

function Money({ value }: { value: number }) {
  return (
    <Text>
      <Text style={s.rs}>₹</Text> {fmt(value)}
    </Text>
  );
}

/** Amount with the percentage underneath, e.g. discount "₹ 308.00 (35.0%)". */
function MoneyPct({ value, pct }: { value: number; pct: number }) {
  return (
    <View>
      <Money value={value} />
      <Text>({fmtPct(pct)})</Text>
    </View>
  );
}

interface Col {
  key: string;
  label: string;
  flex: number;
  align?: "left" | "right";
}

function SellerHeader({ settings, tag, copy }: { settings: SalesSettings; tag: string; copy: string }) {
  return (
    <>
      <View style={s.topRow}>
        <Text style={{ width: 50 }} />
        <Text style={s.topTitle}>{tag}</Text>
        <Text style={s.topTag}>{copy.toUpperCase()}</Text>
      </View>
      <View style={s.header}>
        <View style={s.logoWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {settings.logo_url ? <Image src={settings.logo_url} style={s.logo} /> : null}
        </View>
        <View style={s.seller}>
          <Text style={s.sellerName}>{settings.company_name}</Text>
          <Text style={s.sellerLine}>{settings.address}</Text>
          {settings.msme ? <Text style={s.sellerLine}>MSME: {settings.msme}</Text> : null}
          {settings.website ? <Text style={s.sellerLine}>{settings.website}</Text> : null}
          <Text style={s.sellerLine}>
            {[settings.phone && `Phone no.: ${settings.phone}`, settings.email && `Email: ${settings.email}`]
              .filter(Boolean)
              .join(" ")}
          </Text>
          {settings.gstin ? (
            <Text style={s.sellerLine}>
              GSTIN: {settings.gstin}, State: {settings.state_code}-{settings.state_name}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );
}

/** Present when rendering a quotation: same layout, quotation wording and terms. */
export interface QuoteExtras {
  validUntil: string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
}

export function InvoicePdf({
  invoice,
  settings,
  quote,
}: {
  invoice: Invoice;
  settings: SalesSettings;
  quote?: QuoteExtras;
}) {
  const isQuote = !!quote;
  const { items, totals, bill_to: billTo } = invoice;
  const gst = invoice.gst_enabled;
  const interState = gst && items.some((l) => l.igst > 0);
  const title = isQuote ? "Quotation" : gst ? "Tax Invoice" : "Invoice";

  const cols: Col[] = [
    { key: "idx", label: "#", flex: 0.5, align: "left" },
    { key: "name", label: "Item name", flex: 3.2, align: "left" },
    { key: "hsn", label: "HSN/ SAC", flex: 1.2, align: "left" },
    { key: "qty", label: "Quantity", flex: 1 },
    { key: "unit", label: "Unit", flex: 0.8 },
    { key: "price", label: "Price/ unit", flex: 1.4 },
    { key: "disc", label: "Discount", flex: 1.5 },
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
      case "price": return <Money value={l.unitPrice} />;
      case "disc": return <MoneyPct value={l.discountAmount} pct={l.discountPct} />;
      case "taxable": return <Money value={l.taxable} />;
      case "cgst": return <MoneyPct value={l.cgst} pct={l.gstRate / 2} />;
      case "sgst": return <MoneyPct value={l.sgst} pct={l.gstRate / 2} />;
      case "igst": return <MoneyPct value={l.igst} pct={l.gstRate} />;
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

  const taxRows = (totals.taxSummary ?? [])
    .filter((r) => r.rate > 0)
    .flatMap((r) =>
      interState
        ? [{ type: "IGST", taxable: r.taxable, rate: r.rate, tax: r.igst }]
        : [
            { type: "SGST", taxable: r.taxable, rate: r.rate / 2, tax: r.sgst },
            { type: "CGST", taxable: r.taxable, rate: r.rate / 2, tax: r.cgst },
          ]
    );

  // A quotation is a single page set with no ORIGINAL/DUPLICATE marking.
  const copies = isQuote ? [""] : normalizeCopies(settings.invoice_copies);
  const termsParagraphs = [
    ...(quote?.paymentTerms ? [`Payment Terms: ${quote.paymentTerms}`] : []),
    ...(quote?.deliveryTerms ? [`Delivery Terms: ${quote.deliveryTerms}`] : []),
    ...(quote ? [`This quotation is valid until ${fmtDate(quote.validUntil)}.`] : []),
    ...(settings.terms ?? "").split(/\n{2,}/).filter(Boolean),
  ];

  return (
    <Document title={`${title} ${invoice.invoice_number}`} author={settings.company_name}>
      {copies.map((copy) => (
      <Page key={copy || "quote"} size="A4" style={s.page}>
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
            <Text style={[s.bar, { textAlign: "right" }]}>{isQuote ? "Quotation Details" : "Invoice Details"}</Text>
            <View style={[s.halfPad, { alignItems: "flex-end" }]}>
              <Text style={{ marginBottom: 3 }}>{isQuote ? "Quotation" : "Invoice"} No.: {invoice.invoice_number}</Text>
              <Text style={{ marginBottom: 3 }}>Date: {fmtDate(invoice.invoice_date)}</Text>
              {quote ? <Text style={{ marginBottom: 3 }}>Valid Until: {fmtDate(quote.validUntil)}</Text> : null}
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
            <View style={[s.amountRow, s.rowBorder, s.bold]}><Text style={s.bold}>Total</Text><Text style={s.bold}><Money value={totals.total} /></Text></View>
            {totals.youSaved > 0 ? (
              <View style={s.amountRow}><Text>You Saved</Text><Money value={totals.youSaved} /></View>
            ) : null}
          </View>
        </View>

        <View style={[s.box, { borderTopWidth: 0 }]} wrap={false}>
          <Text style={[s.bar, { textAlign: "center" }]}>{isQuote ? "Quotation" : "Invoice"} Amount In Words</Text>
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
          <View style={[s.half, { borderRightWidth: 0 }]}>
            <Text style={s.bar}>Terms and conditions</Text>
            <View style={s.halfPad}>
              {termsParagraphs.map((p, i) => (
                <Text key={i} style={{ marginBottom: 6 }}>{p}</Text>
              ))}
            </View>
          </View>
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
