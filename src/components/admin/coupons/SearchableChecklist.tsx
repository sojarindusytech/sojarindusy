"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Indentation level, for trees such as categories. */
  depth?: number;
  muted?: boolean;
}

interface SearchableChecklistProps {
  items: ChecklistItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder: string;
  emptyText: string;
  invalid?: boolean;
}

/** A searchable list of checkboxes with a selected-count and clear action. */
export function SearchableChecklist({
  items,
  selectedIds,
  onChange,
  searchPlaceholder,
  emptyText,
  invalid,
}: SearchableChecklistProps) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.sublabel?.toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className={cn("rounded-lg border bg-white", invalid ? "border-rose-300" : "border-slate-200")}>
      <div className="flex items-center gap-2 border-b border-slate-100 p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-xs border-slate-200 bg-slate-50/60"
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{selectedIds.length} selected</span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#024AE5] hover:bg-blue-50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">{emptyText}</p>
        ) : (
          visible.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50"
              style={{ paddingLeft: `${0.5 + (query ? 0 : item.depth ?? 0) * 1.25}rem` }}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#024AE5]"
              />
              <span className="min-w-0">
                <span className={cn("block font-medium", item.muted ? "text-slate-400" : "text-slate-800")}>
                  {item.label}
                </span>
                {item.sublabel && <span className="block truncate text-[11px] text-slate-500">{item.sublabel}</span>}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
