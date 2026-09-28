/**
 * Date-range filtering for list views.
 *
 * Pure and dependency-free so it can be unit-tested, and shared by the admin
 * and manufacturer purchase-order tables so the two cannot drift apart.
 */

export type DateRangeKey = "all" | "today" | "7d" | "30d" | "90d" | "custom";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range" },
];

/** Local midnight at the start of the day `daysAgo` days before `ref`. */
function startOfDay(ref: Date, daysAgo = 0): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Resolves a preset (or a custom from/to pair) into inclusive bounds.
 * `from`/`to` are "YYYY-MM-DD" strings as produced by <input type="date">.
 * Either side of a custom range may be empty, giving an open-ended bound.
 */
export function resolveDateRange(
  range: DateRangeKey,
  from?: string,
  to?: string,
  now: Date = new Date()
): { start: Date | null; end: Date | null } {
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: null };
    case "7d":
      // "Last 7 days" includes today, so we go back 6 whole days.
      return { start: startOfDay(now, 6), end: null };
    case "30d":
      return { start: startOfDay(now, 29), end: null };
    case "90d":
      return { start: startOfDay(now, 89), end: null };
    case "custom": {
      const start = from ? new Date(`${from}T00:00:00`) : null;
      // End of the chosen day, so a single-day range matches that whole day.
      const end = to ? new Date(`${to}T23:59:59.999`) : null;
      return {
        start: start && !isNaN(start.getTime()) ? start : null,
        end: end && !isNaN(end.getTime()) ? end : null,
      };
    }
    case "all":
    default:
      return { start: null, end: null };
  }
}

/** True when `value` falls inside the resolved range. Unparseable dates are excluded. */
export function isWithinDateRange(
  value: string | null | undefined,
  range: DateRangeKey,
  from?: string,
  to?: string,
  now: Date = new Date()
): boolean {
  if (range === "all") return true;
  if (!value) return false;

  const when = new Date(value);
  if (isNaN(when.getTime())) return false;

  const { start, end } = resolveDateRange(range, from, to, now);
  if (start && when < start) return false;
  if (end && when > end) return false;
  return true;
}
