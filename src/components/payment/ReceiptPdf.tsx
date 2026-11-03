import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { Payment, SalesSettings } from "@/types/database.types";
import { amountInWords } from "@/lib/invoice";
import { modeLabel } from "@/lib/payments";
import { documentTerms, termsParagraphs } from "@/lib/document-terms";
import { Money, SellerHeader, fmtDate, s } from "@/components/invoice/pdf-shared";

/** What the receipt shows about each invoice the payment was applied to. */
export interface ReceiptInvoiceInfo {
  invoice_date: string;
  total: number;
  /** Still outstanding on the invoice now (after every received payment). */
  balance: number;
}

/**
 * Pure renderer for a payment receipt: same family and header as the invoice, with the amount in
 * words, how it was received, and where the money was applied. Cancelled receipts say so.
 */
export function ReceiptPdf({
  payment,
  settings,
  invoices,
  payer,
}: {
  payment: Payment;
  settings: SalesSettings;
  invoices: Record<string, ReceiptInvoiceInfo>;
  payer: { address?: string | null; gstin?: string | null };
}) {
  const cancelled = payment.status === "cancelled";
  const allocations = payment.allocations ?? [];
  const receiptTerms = termsParagraphs(documentTerms(settings, "receipt"));

  return (
    <Document title={`Receipt ${payment.receipt_number}`} author={settings.company_name}>
      <Page size="A4" style={s.page}>
        <View fixed>
          <SellerHeader settings={settings} tag="Payment Receipt" copy="" />
        </View>

        {cancelled ? (
          <View style={{ backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#DC2626", padding: 5, marginTop: 4 }}>
            <Text style={{ color: "#B91C1C", fontWeight: 700 }}>
              CANCELLED{payment.cancelled_at ? ` on ${fmtDate(payment.cancelled_at.slice(0, 10))}` : ""}
              {payment.cancel_reason ? `: ${payment.cancel_reason}` : ""}
            </Text>
          </View>
        ) : null}

        <View style={s.split}>
          <View style={[s.half, { borderRightWidth: 0 }]}>
            <Text style={s.bar}>Received From</Text>
            <View style={s.halfPad}>
              <Text style={[s.bold, { marginBottom: 3 }]}>{payment.payer_name}</Text>
              {payer.address ? <Text style={{ marginBottom: 3 }}>{payer.address}</Text> : null}
              {payer.gstin ? <Text>GSTIN Number: {payer.gstin}</Text> : null}
            </View>
          </View>
          <View style={s.half}>
            <Text style={[s.bar, { textAlign: "right" }]}>Receipt Details</Text>
            <View style={[s.halfPad, { alignItems: "flex-end" }]}>
              <Text style={{ marginBottom: 3 }}>Receipt No.: {payment.receipt_number}</Text>
              <Text style={{ marginBottom: 3 }}>Date: {fmtDate(payment.payment_date)}</Text>
              <Text style={{ marginBottom: 3 }}>Received through: {modeLabel(payment.mode)}</Text>
              {payment.reference ? <Text style={{ marginBottom: 3 }}>Reference: {payment.reference}</Text> : null}
              {payment.deposit_account ? <Text>Deposited in: {payment.deposit_account}</Text> : null}
            </View>
          </View>
        </View>

        {/* Amount */}
        <View style={[s.box, { borderTopWidth: 0 }]} wrap={false}>
          <Text style={[s.bar, { textAlign: "center" }]}>Amount Received</Text>
          <View style={{ padding: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: 700 }}>
              <Money value={payment.amount} />
            </Text>
            <Text style={{ marginTop: 3 }}>{amountInWords(payment.amount)}</Text>
          </View>
        </View>

        {/* Where the money went */}
        <View style={{ marginTop: 8 }} wrap={false}>
          <View style={s.row}>
            <Text style={[s.th, { flex: 3, textAlign: "left" }]}>Applied to</Text>
            <Text style={[s.th, { flex: 1.3 }]}>Date</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Total</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Amount applied</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Balance due</Text>
          </View>
          <View style={s.tableBody}>
            {allocations.map((a) => {
              // invoices holds both invoices and debit notes, keyed by their id.
              const doc = a.invoice_id ?? a.debit_note_id ?? null;
              const inv = doc ? invoices[doc] : undefined;
              return (
                <View key={a.id} style={[s.row, s.rowBorder]} wrap={false}>
                  <View style={[s.td, { flex: 3, alignItems: "flex-start" }, s.cellBorder]}>
                    <Text style={s.bold}>
                      {a.kind === "invoice"
                        ? `Invoice ${a.invoice_number ?? ""}`
                        : a.kind === "debit_note"
                          ? `Debit note ${a.debit_note_number ?? ""}`
                          : a.kind === "advance"
                            ? "Advance payment"
                            : `Other${a.note ? `: ${a.note}` : ""}`}
                    </Text>
                  </View>
                  <View style={[s.td, { flex: 1.3 }, s.cellBorder]}><Text>{inv ? fmtDate(inv.invoice_date) : ""}</Text></View>
                  <View style={[s.td, { flex: 1.5 }, s.cellBorder]}>{inv ? <Money value={inv.total} /> : <Text />}</View>
                  <View style={[s.td, { flex: 1.5 }, s.cellBorder]}><Text style={s.bold}><Money value={Number(a.amount)} /></Text></View>
                  <View style={[s.td, { flex: 1.5 }]}>{inv ? <Money value={inv.balance} /> : <Text />}</View>
                </View>
              );
            })}
          </View>
        </View>

        {payment.remarks ? (
          <View style={[s.box, { marginTop: 8 }]} wrap={false}>
            <Text style={s.bar}>Remarks</Text>
            <Text style={{ padding: 4 }}>{payment.remarks}</Text>
          </View>
        ) : null}

        {/* Terms (when set) sit beside the signature so there is never an empty box next to it. */}
        <View style={[s.split, { marginTop: 8, justifyContent: "flex-end" }]} wrap={false}>
          {receiptTerms.length > 0 ? (
            <View style={[s.half, { borderTopWidth: 1, borderRightWidth: 0 }]}>
              <Text style={s.bar}>Terms and conditions</Text>
              <View style={s.halfPad}>
                {receiptTerms.map((p, i) => (
                  <Text key={i} style={{ marginBottom: 4 }}>{p}</Text>
                ))}
              </View>
            </View>
          ) : null}
          <View style={[s.half, { flex: receiptTerms.length > 0 ? 1 : 0, width: receiptTerms.length > 0 ? undefined : "50%", borderTopWidth: 1, alignItems: "center", padding: 4 }]}>
            <Text>For: {settings.company_name}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {settings.signature_url ? <Image src={settings.signature_url} style={s.sig} /> : <View style={{ height: 54 }} />}
            <Text style={s.bold}>Authorized Signatory</Text>
          </View>
        </View>

        <Text fixed style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "#6B7280", fontSize: 8 }}>
          This is a computer generated receipt of payment received.
        </Text>
      </Page>
    </Document>
  );
}
