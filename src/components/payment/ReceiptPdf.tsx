import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { Payment, SalesSettings } from "@/types/database.types";
import { amountInWords } from "@/lib/invoice";
import { modeLabel } from "@/lib/payments";
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
            <Text style={[s.th, { flex: 1.3 }]}>Invoice date</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Invoice total</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Amount applied</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Balance due</Text>
          </View>
          <View style={s.tableBody}>
            {allocations.map((a) => {
              const inv = a.invoice_id ? invoices[a.invoice_id] : undefined;
              return (
                <View key={a.id} style={[s.row, s.rowBorder]} wrap={false}>
                  <View style={[s.td, { flex: 3, alignItems: "flex-start" }, s.cellBorder]}>
                    <Text style={s.bold}>
                      {a.kind === "invoice" ? `Invoice ${a.invoice_number ?? ""}` : a.kind === "advance" ? "Advance payment" : `Other${a.note ? `: ${a.note}` : ""}`}
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

        <View style={[s.split, { marginTop: 8 }]} wrap={false}>
          <View style={[s.half, { borderTopWidth: 1, borderRightWidth: 0, padding: 4, justifyContent: "flex-end" }]}>
            <Text style={{ color: "#6B7280" }}>This is a computer generated receipt of payment received.</Text>
          </View>
          <View style={[s.half, { borderTopWidth: 1, alignItems: "center", padding: 4 }]}>
            <Text>For: {settings.company_name}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {settings.signature_url ? <Image src={settings.signature_url} style={s.sig} /> : <View style={{ height: 54 }} />}
            <Text style={s.bold}>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
