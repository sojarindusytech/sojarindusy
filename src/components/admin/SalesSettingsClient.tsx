"use client";

import { PageTitle } from "@/components/common/PageTitle";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Save, Upload, Settings } from "lucide-react";
import type { SalesSettings } from "@/types/database.types";
import { updateSalesSettings, uploadInvoiceAsset } from "@/actions/sales-settings";
import { financialYear, formatInvoiceNumber, GST_RATE_OPTIONS, INVOICE_COPIES, normalizeCopies, type InvoiceCopy } from "@/lib/invoice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COPY_OPTIONS: Record<InvoiceCopy, { label: string }> = {
  original: { label: "Original" },
  duplicate: { label: "Duplicate" },
  triplicate: { label: "Triplicate" },
};

type NumberingKey = "invoice" | "quote" | "rfq" | "po" | "receipt" | "order";

/** One row per numbered document in the Document Numbering table. */
const NUMBERING_ROWS: { key: NumberingKey; label: string; fallback: string }[] = [
  { key: "invoice", label: "Invoice", fallback: "INV" },
  { key: "quote", label: "Quotation", fallback: "QT" },
  { key: "rfq", label: "RFQ", fallback: "RFQ" },
  { key: "po", label: "Purchase Order", fallback: "PO" },
  { key: "receipt", label: "Payment Receipt", fallback: "RCPT" },
  { key: "order", label: "Order", fallback: "ORD" },
];

// Form values are strings so empty inputs stay empty; the server schema coerces.
type Form = Record<string, string | boolean>;

const TEXT_FIELDS = [
  "company_name", "address", "gstin", "state_code", "state_name", "msme", "website", "phone", "email",
  "logo_url", "signature_url", "bank_name", "bank_address", "account_no", "ifsc", "account_holder",
  "terms", "quote_terms", "receipt_terms", "invoice_prefix", "po_prefix", "rfq_prefix", "quote_prefix", "credit_note_prefix", "quote_payment_terms", "quote_delivery_terms", "receipt_prefix", "order_prefix",
] as const;

function toForm(s: SalesSettings): Form {
  const form: Form = {
    gst_billing_enabled: s.gst_billing_enabled,
    invoice_reduces_stock: s.invoice_reduces_stock !== false,
    credit_note_restores_stock: s.credit_note_restores_stock !== false,
    default_gst_rate: String(s.default_gst_rate),
    invoice_next_number: String(s.invoice_next_number),
    invoice_pad: String(s.invoice_pad),
    po_next_number: String(s.po_next_number ?? 1),
    po_pad: String(s.po_pad ?? 2),
    rfq_next_number: String(s.rfq_next_number ?? 1),
    rfq_pad: String(s.rfq_pad ?? 2),
    quote_next_number: String(s.quote_next_number ?? 1),
    quote_pad: String(s.quote_pad ?? 2),
    credit_note_next_number: String(s.credit_note_next_number ?? 1),
    credit_note_pad: String(s.credit_note_pad ?? 2),
    quote_validity_days: String(s.quote_validity_days ?? 30),
    receipt_next_number: String(s.receipt_next_number ?? 1),
    receipt_pad: String(s.receipt_pad ?? 2),
    order_next_number: String(s.order_next_number ?? 1),
    order_pad: String(s.order_pad ?? 2),
    po_manufacturer_id: s.po_manufacturer_id ?? "",
  };
  for (const k of TEXT_FIELDS) form[k] = (s[k] as string | null) ?? "";
  form.po_prefix = s.po_prefix ?? "SI/PO";
  form.rfq_prefix = s.rfq_prefix ?? "SI/RFQ";
  form.credit_note_prefix = s.credit_note_prefix ?? "SI/CN";
  form.quote_prefix = s.quote_prefix ?? "SI/QT";
  form.receipt_prefix = s.receipt_prefix ?? "SI/RCPT";
  form.order_prefix = s.order_prefix ?? "SI/ORD";
  return form;
}

export function SalesSettingsClient({ initial, manufacturers }: { initial: SalesSettings; manufacturers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [copies, setCopies] = useState<InvoiceCopy[]>(() => normalizeCopies(initial.invoice_copies));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: string) => String(form[k] ?? "");

  const field = (k: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={text(k)} onChange={(e) => set(k, e.target.value)} className="h-9 text-sm" {...props} />
      {errors[k] && <p className="text-[11px] text-red-600">{errors[k]}</p>}
    </div>
  );

  const area = (k: string, label: string, rows = 3) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Textarea id={k} rows={rows} value={text(k)} onChange={(e) => set(k, e.target.value)} className="text-sm" />
      {errors[k] && <p className="text-[11px] text-red-600">{errors[k]}</p>}
    </div>
  );

  // Document numbering table. A stale financial year resets a counter to 1 unless the admin edits it in
  // this save (the save action stamps the year), so the preview follows the same rule as the database.
  const fy = financialYear();
  const initialRec = initial as unknown as Record<string, unknown>;
  const nextPreview = (key: NumberingKey, fallback: string) => {
    const counter = Math.max(1, Number(form[`${key}_next_number`]) || 1);
    const edited = counter !== (Number(initialRec[`${key}_next_number`]) || 1);
    const seq = initialRec[`${key}_fy`] === fy || edited ? counter : 1;
    return formatInvoiceNumber(text(`${key}_prefix`) || fallback, fy, seq, Number(form[`${key}_pad`]) || 2);
  };

  const creditCounter = Math.max(1, Number(form.credit_note_next_number) || 1);
  const creditNext = initial.credit_note_fy === fy || creditCounter !== initial.credit_note_next_number ? creditCounter : 1;
  const creditPreview = formatInvoiceNumber(text("credit_note_prefix") || "SI/CN", fy, creditNext, Number(form.credit_note_pad) || 2);

  const upload = async (kind: "logo" | "signature", file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadInvoiceAsset(fd);
    setUploading(null);
    if (res.error || !res.publicUrl) return void toast.error(res.error || "Upload failed.");
    set(`${kind}_url`, res.publicUrl);
    toast.success("Uploaded. Click Save to apply.");
  };

  const assetField = (kind: "logo" | "signature", label: string) => {
    const url = text(`${kind}_url`);
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-3">
          <div className="h-14 w-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-slate-400">None</span>}
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#024AE5] cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {uploading === kind ? "Uploading..." : "Upload PNG / JPG"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={uploading !== null}
              onChange={(e) => {
                void upload(kind, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {url && (
            <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => set(`${kind}_url`, "")}>
              Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  const save = () =>
    startTransition(async () => {
      const res = await updateSalesSettings({
        ...form,
        gst_billing_enabled: Boolean(form.gst_billing_enabled),
        invoice_reduces_stock: Boolean(form.invoice_reduces_stock),
        credit_note_restores_stock: Boolean(form.credit_note_restores_stock),
        invoice_copies: copies,
      } as never, initial.credit_note_next_number);
      if (res.success) {
        setErrors({});
        toast.success("Sales settings saved.");
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error || "Failed to save settings.");
      }
    });

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <PageTitle icon={Settings}>Sales Settings</PageTitle>
        </div>
        <Button onClick={save} disabled={pending} className="gap-1.5">
          <Save className="h-4 w-4" />
          {pending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Billing</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.gst_billing_enabled)}
            onChange={(e) => set("gst_billing_enabled", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#024AE5]"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Bill with GST by default (admin invoices &amp; quotes)</span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.invoice_reduces_stock)}
            onChange={(e) => set("invoice_reduces_stock", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#024AE5]"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Reduce stock when an invoice is issued</span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={Boolean(form.credit_note_restores_stock)}
            onChange={(e) => set("credit_note_restores_stock", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#024AE5]" />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Restore stock when a credit note is issued</span>
            <span className="block text-xs text-slate-500">
              New credit notes return credited SKU units to stock only when the invoice or linked order previously
              deducted them. Units already returned are skipped. Turn off for financial-only credits or goods that
              cannot be put back in stock. Existing credit notes are unchanged.
            </span>
          </span>
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Default GST %</Label>
            <Select value={text("default_gst_rate")} onValueChange={(v) => set("default_gst_rate", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select GST %" /></SelectTrigger>
              <SelectContent className="bg-white">
                {/* Keep a previously saved non-standard rate selectable. */}
                {[...new Set([...GST_RATE_OPTIONS, Number(text("default_gst_rate"))])]
                  .filter((r) => Number.isFinite(r))
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <SelectItem key={r} value={String(r)} className="text-sm">{r}%</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.default_gst_rate && <p className="text-[11px] text-red-600">{errors.default_gst_rate}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Document Numbering</h2>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left p-2.5 font-bold">Document</th>
                <th className="text-left p-2.5 font-bold w-40">Prefix</th>
                <th className="text-left p-2.5 font-bold w-32">Next number</th>
                <th className="text-left p-2.5 font-bold w-24">Digits</th>
                <th className="text-left p-2.5 font-bold">Next will be</th>
              </tr>
            </thead>
            <tbody>
              {NUMBERING_ROWS.map((row) => {
                const err = errors[`${row.key}_prefix`] || errors[`${row.key}_next_number`] || errors[`${row.key}_pad`];
                return (
                  <tr key={row.key} className="border-t border-slate-100 align-top">
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">{row.label}</div>
                    </td>
                    <td className="p-2">
                      <Input aria-label={`${row.label} prefix`} value={text(`${row.key}_prefix`)} onChange={(e) => set(`${row.key}_prefix`, e.target.value)} className="h-8 text-xs font-mono" />
                    </td>
                    <td className="p-2">
                      <Input aria-label={`${row.label} next number`} type="number" min={1} step={1} value={text(`${row.key}_next_number`)} onChange={(e) => set(`${row.key}_next_number`, e.target.value)} className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </td>
                    <td className="p-2">
                      <Input aria-label={`${row.label} digits`} type="number" min={1} max={8} step={1} value={text(`${row.key}_pad`)} onChange={(e) => set(`${row.key}_pad`, e.target.value)} className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </td>
                    <td className="p-2.5">
                      <span className="font-mono font-bold text-slate-900">{nextPreview(row.key, row.fallback)}</span>
                      {err && <p className="text-[11px] text-red-600 mt-0.5">{err}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Purchase Orders</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Select value={text("po_manufacturer_id") || "none"} onValueChange={(v) => set("po_manufacturer_id", v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="none" className="text-sm">All manufacturers (no one in particular)</SelectItem>
                {manufacturers.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-sm">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.po_manufacturer_id && <p className="text-[11px] text-red-600">{errors.po_manufacturer_id}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Quotation Defaults</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("quote_validity_days", "Validity (days)", { type: "number", min: 1, max: 365, step: 1 })}
          {field("quote_payment_terms", "Default payment terms")}
          {field("quote_delivery_terms", "Default delivery terms")}
        </div>
        <p className="text-[11px] text-slate-500">These prefill every new quotation and can be changed on each one.</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Credit Note Numbering</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("credit_note_prefix", "Prefix", { maxLength: 7 })}
          {field("credit_note_next_number", "Next number", { type: "number", min: 1, max: 99999999, step: 1 })}
          {field("credit_note_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">Next credit note: <span className="font-mono font-bold text-slate-900">{creditPreview}</span> · Restarts at 1 each April.</p>
        <p className="text-[11px] text-slate-500">Choose Auto or Manual on each credit note. A manual number does not move this counter. Numbers use letters, numbers, / and - and must fit within 16 characters. Auto numbering skips numbers already used manually.</p>
      </Card>

      <Card className="p-5 space-y-3 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Invoice Copies</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {INVOICE_COPIES.map((c) => {
            const checked = copies.includes(c);
            return (
              <label key={c} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${checked ? "border-[#024AE5] bg-blue-50/40" : "border-slate-200"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setCopies((prev) => normalizeCopies(e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))
                  }
                  className="mt-0.5 h-4 w-4 accent-[#024AE5]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{COPY_OPTIONS[c].label}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.invoice_copies && <p className="text-[11px] text-red-600">{errors.invoice_copies}</p>}
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Company</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("company_name", "Company name")}
          {field("gstin", "GSTIN")}
        </div>
        {area("address", "Address")}
        <div className="grid sm:grid-cols-2 gap-4">
          {field("state_code", "State code")}
          {field("state_name", "State")}
          {field("phone", "Phone")}
          {field("email", "Email")}
          {field("website", "Website")}
          {field("msme", "MSME / Udyam no.")}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {assetField("logo", "Logo")}
          {assetField("signature", "Signature / stamp")}
        </div>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Bank Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("bank_name", "Bank name")}
          {field("account_holder", "Account holder")}
          {field("account_no", "Account no.")}
          {field("ifsc", "IFSC")}
        </div>
        {area("bank_address", "Bank address", 2)}
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Terms & Conditions</h2>
        <div className="space-y-1">
          {area("terms", "Invoice terms & conditions", 7)}
        </div>
        <div className="space-y-1">
          {area("quote_terms", "Quotation terms & conditions", 7)}
        </div>
        <div className="space-y-1">
          {area("receipt_terms", "Payment receipt note", 4)}
        </div>
      </Card>
    </div>
  );
}
