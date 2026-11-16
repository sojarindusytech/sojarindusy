import { AlertTriangle } from "lucide-react";

/** Shown instead of a list that failed to load, so a database problem never reads as "nothing here yet". */
export function LoadErrorCard({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{message}</span>
    </div>
  );
}

/** Runs a page loader; returns its data or the error message to show. */
export async function loadOrError<T>(load: () => Promise<T>, fallback: T): Promise<{ data: T; loadError: string | null }> {
  try {
    return { data: await load(), loadError: null };
  } catch (err) {
    return { data: fallback, loadError: err instanceof Error ? err.message : "This list could not be loaded." };
  }
}
