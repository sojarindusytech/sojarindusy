import { AdminDebitNotesClient } from "@/components/admin/AdminDebitNotesClient";
import { listDebitNotes, type DebitNoteListRow } from "@/actions/debit-note";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debit Notes | Sojar Solutions Admin",
  description: "GST debit notes issued to customers against tax invoices.",
};

export const dynamic = "force-dynamic";

export default async function DebitNotesAdminPage() {
  let debitNotes: DebitNoteListRow[] = [];
  let loadError: string | null = null;
  try {
    debitNotes = await listDebitNotes();
  } catch (err) {
    // e.g. the migration hasn't been applied: say so on the page instead of a generic error.
    loadError = err instanceof Error ? err.message : "Could not load debit notes.";
  }
  return <AdminDebitNotesClient initialDebitNotes={debitNotes} loadError={loadError} />;
}
