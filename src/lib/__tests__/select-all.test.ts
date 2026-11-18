import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { selectAll } from "../server/select-all";

/** A fake table of `n` rows served the way PostgREST does: at most 1000 per request. */
const table = (n: number) => {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null };
  };
  return { page, calls };
};

describe("selectAll", () => {
  it("reads past the 1000-row limit without skipping or repeating rows", async () => {
    const t = table(2500);
    const rows = await selectAll<{ id: number }>(t.page);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops after one request for a small table, and makes one extra request at an exact multiple", async () => {
    expect((await selectAll(table(3).page))).toHaveLength(3);
    const exact = table(1000);
    expect(await selectAll(exact.page)).toHaveLength(1000);
    expect(exact.calls).toHaveLength(2);
  });

  it("throws on a database error instead of returning a partial list", async () => {
    await expect(
      selectAll(async () => ({ data: null, error: { message: "boom", code: "42P01" } }))
    ).rejects.toMatchObject({ message: "boom", code: "42P01" });
  });
});
