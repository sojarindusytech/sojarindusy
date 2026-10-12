"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Download, Eye, Plus, Settings } from "lucide-react";
import { getCreditNoteFormData, type CreditNoteFormData } from "@/actions/credit-note";
import type { CreditNote } from "@/lib/credit-note";
import { CreditNoteFormModal } from "@/components/admin/CreditNoteFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function AdminCreditNotesClient({ notes, invoiceId, initialFormData = null, customer = false }: { notes: CreditNote[]; invoiceId?: string; initialFormData?: CreditNoteFormData | null; customer?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [formData, setFormData] = useState<CreditNoteFormData | null>(initialFormData);
  const [viewing, setViewing] = useState<CreditNote | null>(null);
  const [pending, startTransition] = useTransition();
  const openForm = () => startTransition(async () => {
    try { setFormData(await getCreditNoteFormData()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load invoices."); }
  });
  const filtered = notes.filter((n) => `${n.credit_note_number} ${n.invoice_number} ${n.bill_to.name} ${n.reason}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-[#0F172A]">Credit Notes</h1><p className="mt-1 text-sm text-slate-500">Invoice adjustments and credit documents.</p></div>{!customer && <div className="flex gap-2"><Button variant="outline" asChild><Link href="/admin/settings/sales"><Settings className="mr-2 h-4 w-4" />Numbering settings</Link></Button><Button onClick={openForm} disabled={pending}><Plus className="mr-2 h-4 w-4" />{pending ? "Loading…" : "New Credit Note"}</Button></div>}</div>
    <Input aria-label="Search credit notes" placeholder="Search number, invoice, customer or reason…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-md" />
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{["Credit note", "Invoice / Customer", "Reason", "Treatment", "Amount", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{filtered.map((n) => <tr key={n.id} className="border-t border-slate-100"><td className="px-4 py-3"><div className="font-mono font-medium">{n.credit_note_number}</div><div className="text-xs text-slate-500">{n.credit_note_date} · {n.numbering_mode}</div></td><td className="px-4 py-3">{n.invoice_number}<div className="text-xs text-slate-500">{n.bill_to.name}</div></td><td className="max-w-xs px-4 py-3"><p className="line-clamp-2">{n.reason}</p></td><td className="px-4 py-3"><Badge variant="outline">{n.treatment === "gst" ? "GST" : "Commercial"}</Badge></td><td className="whitespace-nowrap px-4 py-3 font-semibold">{n.total_amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td><td className="px-4 py-3"><div className="flex"><Button size="sm" variant="ghost" aria-label={`View ${n.credit_note_number}`} onClick={() => setViewing(n)}><Eye className="h-4 w-4" /></Button><Button size="sm" variant="ghost" asChild><a href={`/api/credit-notes/${n.id}/pdf?download=1`} aria-label={`Download ${n.credit_note_number}`}><Download className="h-4 w-4" /></a></Button></div></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">{notes.length ? "No matching credit notes." : "No credit notes issued yet."}</td></tr>}</tbody></table></div>
    {formData && <CreditNoteFormModal data={formData} notes={notes} initialInvoiceId={invoiceId} onClose={() => setFormData(null)} onIssued={(note) => { setFormData(null); setViewing(note); router.refresh(); }} />}
    <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}><DialogContent className="flex h-[90vh] max-w-5xl flex-col"><DialogHeader><DialogTitle>{viewing?.credit_note_number}</DialogTitle><DialogDescription>Credit against {viewing?.invoice_number}</DialogDescription></DialogHeader>{viewing && <iframe title={`Credit note ${viewing.credit_note_number}`} src={`/api/credit-notes/${viewing.id}/pdf`} className="min-h-0 flex-1 rounded-lg border" />}</DialogContent></Dialog>
  </div>;
}
