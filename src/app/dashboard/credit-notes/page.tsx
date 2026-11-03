import { listCreditNotes } from "@/actions/credit-note";
import { AdminCreditNotesClient } from "@/components/admin/AdminCreditNotesClient";
export const dynamic = "force-dynamic";
export default async function CustomerCreditNotesPage() {
  return <AdminCreditNotesClient notes={await listCreditNotes(true)} customer />;
}
