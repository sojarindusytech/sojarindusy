/**
 * Date-range filtering for list views.
 *
 * Pure and dependency-free so it can be unit-tested, and shared by the admin
 * and manufacturer purchase-order tables so the two cannot drift apart.
 */

export type DateRangeKey =
  | "all" | "today" | "7d" | "30d" | "90d"
  | "this_month" | "last_month" | "this_fy" | "last_fy"
  | "custom";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_fy", label: "This Financial Year" },
  { value: "last_fy", label: "Last Financial Year" },
  { value: "custom", label: "Custom Range" },
];

const KEYS = new Set(DATE_RANGE_OPTIONS.map((o) => o.value));
/** Narrows a string (e.g. from the URL) to a known range, else "all". */
export const toDateRangeKey = (v: string | null | undefined): DateRangeKey =>
  v && KEYS.has(v as DateRangeKey) ? (v as DateRangeKey) : "all";

/** True when a custom range ends before it starts (it would match nothing). */
export const isInvertedRange = (from?: string, to?: string) => Boolean(from && to && from > to);

/** Indian financial year (1 April – 31 March) containing `ref`, shifted back `yearsAgo` years. */
function financialYear(ref: Date, yearsAgo = 0): { start: Date; end: Date } {
  const startYear = (ref.getMonth() >= 3 ? ref.getFullYear() : ref.getFullYear() - 1) - yearsAgo;
  return { start: new Date(startYear, 3, 1), end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999) };
}

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
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "this_fy":
      return { start: financialYear(now).start, end: null };
    case "last_fy":
      return financialYear(now, 1);
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

  // A plain "YYYY-MM-DD" document date is a calendar day here, not UTC midnight.
  const when = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (isNaN(when.getTime())) return false;

  const { start, end } = resolveDateRange(range, from, to, now);
  if (start && when < start) return false;
  if (end && when > end) return false;
  return true;
}
