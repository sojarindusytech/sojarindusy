import { getCreditNoteFormData, listCreditNotes } from "@/actions/credit-note";
import { AdminCreditNotesClient } from "@/components/admin/AdminCreditNotesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Credit Notes | Sojar Solutions Admin", description: "Invoice-linked credit notes and numbering." };
export const dynamic = "force-dynamic";
export default async function CreditNotesAdminPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const params = await searchParams;
  const [notes, formData] = await Promise.all([listCreditNotes(), params.invoice ? getCreditNoteFormData() : Promise.resolve(null)]);
  return <AdminCreditNotesClient key={params.invoice ?? "registry"} notes={notes} invoiceId={params.invoice} initialFormData={formData} />;
}
