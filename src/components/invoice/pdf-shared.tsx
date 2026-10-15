import path from "node:path";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SalesSettings } from "@/types/database.types";

/**
 * Pieces shared by every PDF document (invoice, quotation, receipt) so they look like one family:
 * fonts, base styles, money formatting and the seller header.
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

export const ACCENT = "#00B0F0";
export const BORDER = "#8A8A8A";

export const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 28, fontFamily: "Roboto", fontSize: 8, color: "#111" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  topTitle: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700 },
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

export const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtDate = (iso: string) => iso.split("-").reverse().join("-");

export function Money({ value }: { value: number }) {
  return (
    <Text>
      <Text style={s.rs}>₹</Text> {fmt(value)}
    </Text>
  );
}

export function SellerHeader({ settings, tag, copy }: { settings: SalesSettings; tag: string; copy: string }) {
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
