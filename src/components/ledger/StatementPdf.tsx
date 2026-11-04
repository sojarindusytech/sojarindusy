import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { SalesSettings } from "@/types/database.types";
import { VOUCHER_LABELS, drCrText, round2, type ReportLine } from "@/lib/ledger";
import { ACCENT, Money, SellerHeader, fmt, fmtDate, s } from "@/components/invoice/pdf-shared";

/**
 * Column widths as percentages. Every row (header, opening, entries, closing) uses all six columns
 * with these exact widths, so each column line runs straight down the table. (Flex widths drift when
 * a row merges cells, because padding and borders are counted per cell.)
 */
const W = { date: "10.5%", particulars: "33%", vch: "17.5%", debit: "12.5%", credit: "12.5%", balance: "14%" } as const;
const left = { textAlign: "left" as const, alignItems: "flex-start" as const, justifyContent: "flex-start" as const };

export interface StatementPdfParty {
  name: string;
  address: string | null;
  gstin: string | null;
  role: "customer" | "manufacturer";
}

/**
 * Statement of account (Party Ledger) in the same family as the invoice PDF: opening balance,
 * every entry with a running balance, closing balance and, for customers, how old the dues are.
 * Amounts in the body are plain numbers (the body font has no rupee glyph; <Money> has it).
 */
export function StatementPdf({
  settings,
  party,
  from,
  to,
  opening,
  lines,
  ageing,
}: {
  settings: SalesSettings;
  party: StatementPdfParty;
  from: string;
  to: string;
  opening: number;
  lines: ReportLine[];
  ageing: { due: number; d0_30: number; d31_60: number; d61_90: number; d90_plus: number } | null;
}) {
  const debit = round2(lines.reduce((t, l) => t + l.debit, 0));
  const credit = round2(lines.reduce((t, l) => t + l.credit, 0));
  const closing = round2(opening + debit - credit);

  return (
    <Document title={`Statement ${party.name} ${from} to ${to}`} author={settings.company_name}>
      <Page size="A4" style={s.page}>
        <View fixed>
          <SellerHeader settings={settings} tag="Statement of Account" copy="" />
        </View>

        <View style={s.split}>
          <View style={[s.half, { borderRightWidth: 0 }]}>
            <Text style={s.bar}>{party.role === "customer" ? "Customer" : "Manufacturer"}</Text>
            <View style={s.halfPad}>
              <Text style={[s.bold, { marginBottom: 3 }]}>{party.name}</Text>
              {party.address ? <Text style={{ marginBottom: 3 }}>{party.address}</Text> : null}
              {party.gstin ? <Text>GSTIN Number: {party.gstin}</Text> : null}
            </View>
          </View>
          <View style={s.half}>
            <Text style={[s.bar, { textAlign: "right" }]}>Period</Text>
            <View style={[s.halfPad, { alignItems: "flex-end" }]}>
              <Text style={{ marginBottom: 3 }}>{fmtDate(from)} to {fmtDate(to)}</Text>
              <Text style={{ marginBottom: 3 }}>Opening balance: {drCrText(opening)}</Text>
              <Text style={s.bold}>Closing balance: {drCrText(closing)}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          {/* Same side borders as the body, so the header columns line up with it. */}
          <View style={[s.row, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: ACCENT }]} fixed>
            <Text style={[s.th, { width: W.date, textAlign: "left" }]}>Date</Text>
            <Text style={[s.th, { width: W.particulars, textAlign: "left" }]}>Particulars</Text>
            <Text style={[s.th, { width: W.vch, textAlign: "left" }]}>Voucher</Text>
            <Text style={[s.th, { width: W.debit }]}>Debit</Text>
            <Text style={[s.th, { width: W.credit }]}>Credit</Text>
            <Text style={[s.th, { width: W.balance }]}>Balance</Text>
          </View>
          <View style={s.tableBody}>
            <View style={[s.row, s.rowBorder]} wrap={false}>
              <Text style={[s.td, { width: W.date, textAlign: "left" }, s.cellBorder]}>{fmtDate(from)}</Text>
              <Text style={[s.td, { width: W.particulars, textAlign: "left" }, s.bold, s.cellBorder]}>Opening balance</Text>
              <Text style={[s.td, { width: W.vch }, s.cellBorder]} />
              <Text style={[s.td, { width: W.debit }, s.cellBorder]} />
              <Text style={[s.td, { width: W.credit }, s.cellBorder]} />
              <Text style={[s.td, { width: W.balance }, s.bold]}>{drCrText(opening)}</Text>
            </View>
            {lines.map((l) => (
              <View key={l.line_id} style={[s.row, s.rowBorder]} wrap={false}>
                <Text style={[s.td, { width: W.date, textAlign: "left" }, s.cellBorder]}>{fmtDate(l.entry_date)}</Text>
                <View style={[s.td, { width: W.particulars, ...left }, s.cellBorder]}>
                  <Text>{l.narration ?? ""}</Text>
                  {l.voucher_type === "receipt" && l.bill_ref ? <Text style={{ color: "#4B5563" }}>Against {l.bill_ref}</Text> : null}
                  {l.line_narration ? <Text style={{ color: "#4B5563" }}>{l.line_narration}</Text> : null}
                </View>
                <View style={[s.td, { width: W.vch, ...left }, s.cellBorder]}>
                  <Text>{VOUCHER_LABELS[l.voucher_type]}{l.is_reversal ? " (reversal)" : ""}</Text>
                  <Text style={{ color: "#4B5563" }}>{l.voucher_number}</Text>
                </View>
                <Text style={[s.td, { width: W.debit }, s.cellBorder]}>{l.debit ? fmt(l.debit) : ""}</Text>
                <Text style={[s.td, { width: W.credit }, s.cellBorder]}>{l.credit ? fmt(l.credit) : ""}</Text>
                <Text style={[s.td, { width: W.balance }]}>{drCrText(l.balance)}</Text>
              </View>
            ))}
            <View style={s.row} wrap={false}>
              <Text style={[s.td, { width: W.date }, s.cellBorder]} />
              <Text style={[s.td, { width: W.particulars, textAlign: "left" }, s.bold, s.cellBorder]}>Closing balance</Text>
              <Text style={[s.td, { width: W.vch }, s.cellBorder]} />
              <Text style={[s.td, { width: W.debit }, s.bold, s.cellBorder]}>{fmt(debit)}</Text>
              <Text style={[s.td, { width: W.credit }, s.bold, s.cellBorder]}>{fmt(credit)}</Text>
              <Text style={[s.td, { width: W.balance }, s.bold]}>{drCrText(closing)}</Text>
            </View>
          </View>
        </View>

        {ageing ? (
          <View style={[s.box, { marginTop: 8 }]} wrap={false}>
            <Text style={s.bar}>Amount due by age (as on {fmtDate(to)})</Text>
            <View style={[s.row, { padding: 4 }]}>
              {([
                ["0-30 days", ageing.d0_30],
                ["31-60 days", ageing.d31_60],
                ["61-90 days", ageing.d61_90],
                ["Over 90 days", ageing.d90_plus],
              ] as const).map(([label, value]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ color: "#4B5563" }}>{label}</Text>
                  <Text style={s.bold}>{fmt(value)}</Text>
                </View>
              ))}
              <View style={{ flex: 1.3, alignItems: "flex-end" }}>
                <Text style={{ color: "#4B5563" }}>Total due</Text>
                <Text style={[s.bold, { fontSize: 10 }]}><Money value={ageing.due} /></Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={{ color: "#4B5563" }}>
            Dr = amount due to {settings.company_name}. Cr = amount due to {party.name} or paid in advance.
            Please report any difference within 15 days of receiving this statement.
          </Text>
        </View>

        <Text fixed style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "#6B7280", fontSize: 8 }}
          render={({ pageNumber, totalPages }) => `This is a computer generated statement. Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
