"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface PaginationState<T> {
  /** The rows to render on the current page. */
  pageItems: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Client-side pagination over an already filtered list. `resetKey` should change
 * whenever the filters do (e.g. `${search}|${status}`) so the view returns to page 1.
 */
export function usePagination<T>(items: T[], resetKey = "", initialPageSize = 10): PaginationState<T> {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [seenKey, setSeenKey] = useState(resetKey);

  // Reset on filter change during render (no effect, no extra paint of a stale page).
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPageRaw(1);
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Also clamps when rows disappear (e.g. after a delete or refresh).
  const current = Math.min(page, totalPages);

  return {
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageSize,
    total,
    totalPages,
    setPage: (p) => setPageRaw(Math.min(Math.max(1, p), totalPages)),
    setPageSize: (size) => {
      setPageSizeRaw(size);
      setPageRaw(1);
    },
  };
}

/** Footer bar: "Showing 1 to 10 of 42 invoices", rows-per-page, and page buttons. Hidden when there is nothing to page. */
export function PaginationBar<T>({ state, noun }: { state: PaginationState<T>; noun: string }) {
  const { page, pageSize, total, totalPages, setPage, setPageSize } = state;
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 border-t border-slate-200 bg-slate-50/60">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Showing <strong className="font-semibold text-slate-800">{from}</strong> to{" "}
          <strong className="font-semibold text-slate-800">{to}</strong> of{" "}
          <strong className="font-semibold text-slate-800">{total}</strong> {noun}
        </span>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-slate-400">Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-7 w-[68px] text-xs bg-white border-slate-200 py-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </Button>
          {pages.map((p, i) => (
            <div key={p} className="flex items-center">
              {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-slate-400 text-xs">…</span>}
              <Button
                type="button"
                size="sm"
                variant={p === page ? "default" : "outline"}
                aria-current={p === page ? "page" : undefined}
                onClick={() => setPage(p)}
                className={`h-7 w-7 p-0 text-xs font-semibold ${p === page ? "bg-[#024AE5] text-white hover:bg-[#023ecc]" : "border-slate-200 text-slate-700 hover:bg-white"}`}
              >
                {p}
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40">
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </nav>
      )}
    </div>
  );
}
