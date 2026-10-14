"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Save, Upload } from "lucide-react";
import type { SalesSettings } from "@/types/database.types";
import { updateSalesSettings, uploadInvoiceAsset } from "@/actions/sales-settings";
import { financialYear, formatInvoiceNumber, GST_RATE_OPTIONS, INVOICE_COPIES, normalizeCopies, type InvoiceCopy } from "@/lib/invoice";
import { MAX_DEBIT_NOTE_NUMBER_LENGTH } from "@/lib/debit-notes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COPY_OPTIONS: Record<InvoiceCopy, { label: string; hint: string }> = {
  original: { label: "Original", hint: "For the recipient (buyer)" },
  duplicate: { label: "Duplicate", hint: "For the transporter" },
  triplicate: { label: "Triplicate", hint: "For the supplier (your records)" },
};

// Form values are strings so empty inputs stay empty; the server schema coerces.
type Form = Record<string, string | boolean>;

const TEXT_FIELDS = [
  "company_name", "address", "gstin", "state_code", "state_name", "msme", "website", "phone", "email",
  "logo_url", "signature_url", "bank_name", "bank_address", "account_no", "ifsc", "account_holder",
  "terms", "invoice_prefix", "po_prefix", "rfq_prefix", "quote_prefix", "quote_payment_terms", "quote_delivery_terms", "receipt_prefix",
  "debit_note_prefix",
] as const;

function toForm(s: SalesSettings): Form {
  const form: Form = {
    gst_billing_enabled: s.gst_billing_enabled,
    invoice_reduces_stock: s.invoice_reduces_stock !== false,
    default_gst_rate: String(s.default_gst_rate),
    invoice_next_number: String(s.invoice_next_number),
    invoice_pad: String(s.invoice_pad),
    po_next_number: String(s.po_next_number ?? 1),
    po_pad: String(s.po_pad ?? 2),
    rfq_next_number: String(s.rfq_next_number ?? 1),
    rfq_pad: String(s.rfq_pad ?? 2),
    quote_next_number: String(s.quote_next_number ?? 1),
    quote_pad: String(s.quote_pad ?? 2),
    quote_validity_days: String(s.quote_validity_days ?? 30),
    receipt_next_number: String(s.receipt_next_number ?? 1),
    receipt_pad: String(s.receipt_pad ?? 2),
    debit_note_next_number: String(s.debit_note_next_number ?? 1),
    debit_note_pad: String(s.debit_note_pad ?? 2),
  };
  for (const k of TEXT_FIELDS) form[k] = (s[k] as string | null) ?? "";
  form.po_prefix = s.po_prefix ?? "SI/PO";
  form.rfq_prefix = s.rfq_prefix ?? "SI/RFQ";
  form.quote_prefix = s.quote_prefix ?? "SI/QT";
  form.receipt_prefix = s.receipt_prefix ?? "SI/RCPT";
  form.debit_note_prefix = s.debit_note_prefix ?? "SI/DN";
  return form;
}

export function SalesSettingsClient({ initial }: { initial: SalesSettings }) {
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

  // Preview what the next auto number will be. A stale FY resets the counter to 1
  // unless the admin edits the counter in this save (the action stamps the FY).
  const fy = financialYear();
  const counter = Math.max(1, Number(form.invoice_next_number) || 1);
  const counterEdited = counter !== initial.invoice_next_number;
  const nextSeq = initial.invoice_fy === fy || counterEdited ? counter : 1;
  const preview = formatInvoiceNumber(text("invoice_prefix") || "INV", fy, nextSeq, Number(form.invoice_pad) || 2);

  // Same rule as invoices: a stale FY resets the counter to 1 unless the admin edits it in this save.
  const poCounter = Math.max(1, Number(form.po_next_number) || 1);
  const poCounterEdited = poCounter !== (initial.po_next_number ?? 1);
  const poNextSeq = initial.po_fy === fy || poCounterEdited ? poCounter : 1;
  const poPreview = formatInvoiceNumber(text("po_prefix") || "PO", fy, poNextSeq, Number(form.po_pad) || 2);

  const rfqCounter = Math.max(1, Number(form.rfq_next_number) || 1);
  const rfqCounterEdited = rfqCounter !== (initial.rfq_next_number ?? 1);
  const rfqNextSeq = initial.rfq_fy === fy || rfqCounterEdited ? rfqCounter : 1;
  const rfqPreview = formatInvoiceNumber(text("rfq_prefix") || "RFQ", fy, rfqNextSeq, Number(form.rfq_pad) || 2);

  const quoteCounter = Math.max(1, Number(form.quote_next_number) || 1);
  const quoteCounterEdited = quoteCounter !== (initial.quote_next_number ?? 1);
  const quoteNextSeq = initial.quote_fy === fy || quoteCounterEdited ? quoteCounter : 1;
  const quotePreview = formatInvoiceNumber(text("quote_prefix") || "QT", fy, quoteNextSeq, Number(form.quote_pad) || 2);

  const receiptCounter = Math.max(1, Number(form.receipt_next_number) || 1);
  const receiptCounterEdited = receiptCounter !== (initial.receipt_next_number ?? 1);
  const receiptNextSeq = initial.receipt_fy === fy || receiptCounterEdited ? receiptCounter : 1;
  const receiptPreview = formatInvoiceNumber(text("receipt_prefix") || "RCPT", fy, receiptNextSeq, Number(form.receipt_pad) || 2);

  const debitNoteCounter = Math.max(1, Number(form.debit_note_next_number) || 1);
  const debitNoteCounterEdited = debitNoteCounter !== (initial.debit_note_next_number ?? 1);
  const debitNoteNextSeq = initial.debit_note_fy === fy || debitNoteCounterEdited ? debitNoteCounter : 1;
  const debitNotePreview = formatInvoiceNumber(text("debit_note_prefix") || "DN", fy, debitNoteNextSeq, Number(form.debit_note_pad) || 2);
  const debitNoteTooLong = debitNotePreview.length > MAX_DEBIT_NOTE_NUMBER_LENGTH;

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
        invoice_copies: copies,
      } as never);
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Company details, GST billing and invoice numbering used on every invoice.</p>
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
            <span className="block text-sm font-semibold text-slate-900">Bill with GST</span>
            <span className="block text-xs text-slate-500">
              Default for new invoices. Turn off for non-GST billing (plain invoice, no tax). Each invoice can still override this when created.
            </span>
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
            <span className="block text-xs text-slate-500">
              Hand-made invoices take their SKU units off the shelf (and give them back if cancelled); an invoice that would
              take more than is available is refused. Invoices raised from orders are not affected: an order takes its stock
              out when you set it to Shipped.
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
        <p className="text-[11px] text-slate-500">Used for any SKU without its own GST % (set per SKU in Product Management).</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Invoice Numbering</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("invoice_prefix", "Prefix")}
          {field("invoice_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("invoice_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next invoice: <span className="font-mono font-bold text-slate-900">{preview}</span>
          <span className="text-slate-400"> · Financial year {fy} (April–March); the counter restarts at 1 each April.</span>
        </p>
        <p className="text-[11px] text-slate-500">You can also type a custom number on any single invoice; it doesn&apos;t move this counter.</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Purchase Order Numbering</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("po_prefix", "Prefix")}
          {field("po_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("po_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next purchase order: <span className="font-mono font-bold text-slate-900">{poPreview}</span>
          <span className="text-slate-400"> · Used for automatic low-stock POs and new POs created without a typed number. Restarts at 1 each April.</span>
        </p>
        <p className="text-[11px] text-slate-500">You can also type a custom PO number when creating a purchase order by hand; it doesn&apos;t move this counter.</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">RFQ Numbering</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("rfq_prefix", "Prefix")}
          {field("rfq_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("rfq_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next RFQ: <span className="font-mono font-bold text-slate-900">{rfqPreview}</span>
          <span className="text-slate-400"> · Used for customer-submitted RFQs and RFQs created without a typed number. Restarts at 1 each April.</span>
        </p>
        <p className="text-[11px] text-slate-500">You can also type a custom RFQ number when creating an RFQ by hand; it doesn&apos;t move this counter.</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Quotations</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("quote_prefix", "Prefix")}
          {field("quote_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("quote_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next quotation: <span className="font-mono font-bold text-slate-900">{quotePreview}</span>
          <span className="text-slate-400"> · Restarts at 1 each April. A number typed on a single quotation doesn&apos;t move this counter.</span>
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("quote_validity_days", "Validity (days)", { type: "number", min: 1, max: 365, step: 1 })}
          {field("quote_payment_terms", "Default payment terms")}
          {field("quote_delivery_terms", "Default delivery terms")}
        </div>
        <p className="text-[11px] text-slate-500">These prefill every new quotation and can be changed on each one.</p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Payment Receipts</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("receipt_prefix", "Prefix")}
          {field("receipt_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("receipt_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next receipt: <span className="font-mono font-bold text-slate-900">{receiptPreview}</span>
          <span className="text-slate-400"> · Restarts at 1 each April. A number typed on a single receipt doesn&apos;t move this counter.</span>
        </p>
      </Card>

      <Card className="p-5 space-y-4 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Debit Notes</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("debit_note_prefix", "Prefix")}
          {field("debit_note_next_number", "Next number", { type: "number", min: 1, step: 1 })}
          {field("debit_note_pad", "Digits", { type: "number", min: 1, max: 8, step: 1 })}
        </div>
        <p className="text-xs text-slate-600">
          Next debit note: <span className={`font-mono font-bold ${debitNoteTooLong ? "text-red-600" : "text-slate-900"}`}>{debitNotePreview}</span>
          <span className="text-slate-400"> · Restarts at 1 each April. A number typed on a single debit note doesn&apos;t move this counter.</span>
        </p>
        <p className={`text-[11px] ${debitNoteTooLong ? "text-red-600" : "text-slate-500"}`}>
          GST allows at most {MAX_DEBIT_NOTE_NUMBER_LENGTH} characters (letters, digits, / and -) in a debit note number
          {debitNoteTooLong ? `; this one has ${debitNotePreview.length}. Shorten the prefix or use fewer digits.` : "."}
        </p>
      </Card>

      <Card className="p-5 space-y-3 shadow-none border-slate-200 rounded-xl">
        <h2 className="text-sm font-bold text-slate-900">Invoice Copies</h2>
        <p className="text-[11px] text-slate-500">
          Each ticked copy is printed as its own set of pages in the invoice PDF, marked ORIGINAL, DUPLICATE or TRIPLICATE at the top right.
        </p>
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
                  <span className="block text-xs text-slate-500">{COPY_OPTIONS[c].hint}</span>
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
        <h2 className="text-sm font-bold text-slate-900">Bank Details & Terms</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("bank_name", "Bank name")}
          {field("account_holder", "Account holder")}
          {field("account_no", "Account no.")}
          {field("ifsc", "IFSC")}
        </div>
        {area("bank_address", "Bank address", 2)}
        {area("terms", "Terms & conditions", 8)}
      </Card>
    </div>
  );
}
