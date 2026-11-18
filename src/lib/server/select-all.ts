import "server-only";

type PageResult = PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/** Rows per request: Supabase (PostgREST) returns at most 1000 rows from one call. */
const PAGE = 1000;
/** Safety cap so a runaway table can't load unbounded data into memory. */
const MAX_ROWS = 100_000;

/**
 * Reads every row of a query, 1000 at a time, instead of silently stopping at Supabase's
 * 1000-row limit. `page(from, to)` must build the same query each time with `.range(from, to)`
 * and a stable order (add `.order("id")` as a tie-breaker) so pages neither skip nor repeat rows.
 * Throws on a database error.
 */
export async function selectAll<T>(page: (from: number, to: number) => PageResult): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const chunk = (data as T[] | null) ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}
