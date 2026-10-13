import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A customer sees an invoice only once it can no longer be a surprise:
 *   - hand-made (order-less) invoices as soon as they are issued;
 *   - an order's invoice only after the order is delivered. It is raised at
 *     shipment, but the customer has not received the goods yet.
 * Mirrors the "Customers can read own invoices" policy (20261017), which
 * protects direct database access; the server uses the service role, which
 * bypasses RLS, so it applies the same rule here.
 */
export async function filterCustomerVisibleInvoices<T extends { order_id: string | null }>(rows: T[]): Promise<T[]> {
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((id): id is string => !!id))];
  if (orderIds.length === 0) return rows;

  const { data } = await createAdminClient().from("orders").select("id, status").in("id", orderIds);
  const delivered = new Set(((data as { id: string; status: string }[] | null) ?? []).filter((o) => o.status === "delivered").map((o) => o.id));
  return rows.filter((r) => !r.order_id || delivered.has(r.order_id));
}

export async function isInvoiceVisibleToCustomer(invoice: { order_id: string | null }): Promise<boolean> {
  return (await filterCustomerVisibleInvoices([invoice])).length === 1;
}
