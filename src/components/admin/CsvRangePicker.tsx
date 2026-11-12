"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clampCsvRange, type CsvRange } from "@/lib/csv-grid";

const MAX_LINES = 200;
const MAX_COLUMNS = 20;

/** Number box that lets you clear and retype; commits only whole numbers >= 1. */
function LineField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  // Only set while typing, so an empty box can be retyped; otherwise the box shows the real value.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold text-slate-600">{label}</Label>
      <Input
        type="number"
        min={1}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= 1) onCommit(n);
        }}
        onBlur={() => setDraft(null)}
        className="h-8 w-28 text-xs bg-white border-slate-200"
      />
    </div>
  );
}

interface Props {
  grid: string[][];
  range: CsvRange;
  /** Data rows the current range yields. */
  dataRowCount: number;
  onChange: (range: CsvRange) => void;
}

/** Lets the admin say which file line is the heading and which lines are data. */
export function CsvRangePicker({ grid, range, dataRowCount, onChange }: Props) {
  const update = (patch: Partial<CsvRange>) => {
    const next = { ...range, ...patch };
    // Moving the heading below the first data line pushes the data start down with it.
    if (patch.headerRow !== undefined && next.dataFrom <= next.headerRow) next.dataFrom = next.headerRow + 1;
    onChange(clampCsvRange(grid, next));
  };

  const shown = grid.slice(0, MAX_LINES);
  const columns = Math.min(MAX_COLUMNS, Math.max(1, ...shown.map((r) => r.length)));
  const headerEmpty = !(grid[range.headerRow - 1] ?? []).some((c) => c.trim() !== "");

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-700">Choose heading and data rows</span>
          <span className="block text-[10px] text-slate-500">
            Line numbers are the file&apos;s own. Click a line below to use it as the heading.
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <LineField label="Heading row" value={range.headerRow} onCommit={(n) => update({ headerRow: n })} />
          <LineField label="Data from row" value={range.dataFrom} onCommit={(n) => update({ dataFrom: n })} />
          <LineField label="Data to row" value={range.dataTo} onCommit={(n) => update({ dataTo: n })} />
          <button
            type="button"
            onClick={() => update({ dataFrom: range.headerRow + 1, dataTo: grid.length })}
            className="text-[11px] font-medium text-[#024AE5] hover:underline cursor-pointer pb-2"
          >
            All rows after heading
          </button>
        </div>
        <p className={cn("text-[11px] font-semibold", headerEmpty || dataRowCount === 0 ? "text-red-600" : "text-[#3C8B4F]")}>
          {headerEmpty
            ? `Row ${range.headerRow} is empty, so there are no column names. Pick another heading row.`
            : dataRowCount === 0
              ? "No data rows in this range."
              : `${dataRowCount} data row${dataRowCount === 1 ? "" : "s"} will be read.`}
        </p>
      </div>

      <div className="overflow-auto max-h-56">
        <table className="w-full text-[11px] border-collapse">
          <tbody>
            {shown.map((cells, i) => {
              const line = i + 1;
              const isHeader = line === range.headerRow;
              const isData = !isHeader && line >= range.dataFrom && line <= range.dataTo;
              return (
                <tr
                  key={line}
                  onClick={() => update({ headerRow: line })}
                  title={`Use row ${line} as the heading`}
                  className={cn(
                    "cursor-pointer border-b border-slate-100",
                    isHeader && "bg-blue-100 font-bold text-[#024AE5]",
                    isData && "bg-white hover:bg-slate-50",
                    !isHeader && !isData && "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  <td className="sticky left-0 w-14 px-2 py-1 text-center border-r border-slate-200 bg-inherit text-slate-500 whitespace-nowrap">
                    {line}
                    {isHeader && <span className="block text-[9px] uppercase tracking-wider text-[#024AE5]">Heading</span>}
                  </td>
                  {Array.from({ length: columns }, (_, c) => (
                    <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[140px] truncate border-l border-slate-100">
                      {cells[c] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {grid.length > MAX_LINES && (
          <p className="px-3 py-2 text-[10px] text-slate-400">
            Showing the first {MAX_LINES} of {grid.length} lines. You can still type a later row number above.
          </p>
        )}
      </div>
    </div>
  );
}
