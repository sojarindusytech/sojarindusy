import "server-only";

/**
 * Business errors raised by the database functions (see the 20261015_04
 * migration) arrive as SQLSTATE P0001 with a stable code in the message, e.g.
 * COUPON_LIMIT_REACHED, and optional JSON context in DETAIL.
 */
export interface DbAppError {
  /** Stable code from the database, or a generic code for unexpected errors. */
  code: string;
  /** Parsed DETAIL payload, when the function supplied one. */
  detail: Record<string, unknown>;
  /** The raw message, for server logs only. Never show it to users. */
  raw: string;
}

interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  code?: string;
}

const APP_ERROR_SQLSTATE = "P0001";
const UNIQUE_VIOLATION = "23505";

export function parseDbError(error: PostgrestLikeError): DbAppError {
  const raw = error.message ?? "Unknown database error";
  let detail: Record<string, unknown> = {};
  if (error.details) {
    try {
      const parsed: unknown = JSON.parse(error.details);
      if (parsed && typeof parsed === "object") detail = parsed as Record<string, unknown>;
    } catch {
      // DETAIL is free text for non-application errors; keep it out of the payload.
    }
  }

  if (error.code === APP_ERROR_SQLSTATE && /^[A-Z][A-Z0-9_]+$/.test(raw)) {
    return { code: raw, detail, raw };
  }
  if (error.code === UNIQUE_VIOLATION) {
    return { code: "UNIQUE_VIOLATION", detail: { constraint: extractConstraint(raw) }, raw };
  }
  return { code: "DATABASE_ERROR", detail, raw };
}

function extractConstraint(message: string): string | null {
  const match = message.match(/constraint "([^"]+)"/);
  return match ? match[1] : null;
}
