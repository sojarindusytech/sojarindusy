import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";

/**
 * Which order status changes are allowed. Mirrors transition_order_status()
 * in the 20261015_04 migration (as amended by 20261017_stock_ledger), which is the authority; this copy lets the
 * admin screens hide moves the database would refuse.
 *
 *   cancelled, returned        final: nothing moves out of them
 *   delivered                  can only become returned
 *   returned                   only from shipped or delivered
 *   pending, confirmed,        not shipped yet (stock only reserved): can move freely between
 *   processing                 each other, or to shipped, delivered or cancelled
 *   shipped                    stock is out and the invoice is raised: can only become
 *                              delivered or returned (never back, never cancelled)
 */
const PRE_SHIP: OrderStatus[] = [
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PROCESSING,
];

export function isFinalStatus(status: OrderStatus): boolean {
  return status === ORDER_STATUSES.CANCELLED || status === ORDER_STATUSES.RETURNED;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true; // details-only update (tracking number, notes)
  if (isFinalStatus(from)) return false;
  if (from === ORDER_STATUSES.DELIVERED) return to === ORDER_STATUSES.RETURNED;
  if (to === ORDER_STATUSES.RETURNED) return from === ORDER_STATUSES.SHIPPED;
  if (from === ORDER_STATUSES.SHIPPED) return to === ORDER_STATUSES.DELIVERED;
  return PRE_SHIP.includes(from);
}

export function allowedStatuses(from: OrderStatus): OrderStatus[] {
  return (Object.values(ORDER_STATUSES) as OrderStatus[]).filter((to) => canTransition(from, to));
}
