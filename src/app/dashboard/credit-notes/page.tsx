import { loadOrError } from "@/components/common/LoadErrorCard";
import { listCreditNotes } from "@/actions/credit-note";
import { AdminCreditNotesClient } from "@/components/admin/AdminCreditNotesClient";
export const dynamic = "force-dynamic";
export default async function CustomerCreditNotesPage() {
  const { data: notes, loadError } = await loadOrError(() => listCreditNotes(true), []);
  return <AdminCreditNotesClient notes={notes} loadError={loadError} customer />;
}
