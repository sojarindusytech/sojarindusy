/**
 * Coupon validity is chosen as whole calendar days in India time (IST, UTC+5:30,
 * no daylight saving): "valid from 1 Oct to 31 Oct" means from 00:00 on 1 Oct
 * to 23:59:59.999 on 31 Oct, IST, whatever timezone the admin's browser is in.
 */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

/** "2026-10-01" -> "2026-10-01T00:00:00.000+05:30" */
export function istDayStart(date: string): string {
  return `${date}T00:00:00.000${IST_OFFSET}`;
}

/** "2026-10-31" -> "2026-10-31T23:59:59.999+05:30" */
export function istDayEnd(date: string): string {
  return `${date}T23:59:59.999${IST_OFFSET}`;
}

/** A timestamp -> its calendar date in IST, as YYYY-MM-DD (for date inputs). */
export function toIstDateInput(value: string | Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** "12 Oct 2026" in IST. */
export function formatIstDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string {
  return toIstDateInput(now);
}
