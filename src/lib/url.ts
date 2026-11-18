/**
 * The URL as a string when it is an absolute http(s) link, else null. Used for links typed by
 * admins and shown to customers (tracking links): a "javascript:" or "data:" link would run in
 * the customer's browser.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
