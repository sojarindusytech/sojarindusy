"use client";

import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_RANGE_OPTIONS, isInvertedRange, toDateRangeKey, type DateRangeKey } from "@/lib/date-range";
import { useUrlState } from "@/lib/use-url-state";

export interface DateRangeValue {
  range: DateRangeKey;
  from: string;
  to: string;
}

/** Date-range filter state kept in the URL (?range=this_fy&from=…&to=…). */
export function useDateRangeFilter(): DateRangeValue & {
  setRange: (v: DateRangeKey) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  key: string;
} {
  const [range, setRange] = useUrlState("range", "all");
  const [from, setFrom] = useUrlState("from");
  const [to, setTo] = useUrlState("to");
  const r = toDateRangeKey(range);
  return { range: r, from, to, setRange, setFrom, setTo, key: `${r}|${from}|${to}` };
}

/** Preset picker plus custom from/to; warns when the custom range is backwards. */
export function DateRangeFilter({ state }: { state: ReturnType<typeof useDateRangeFilter> }) {
  const { range, from, to, setRange, setFrom, setTo } = state;
  return (
    <>
      <Select value={range} onValueChange={(v) => setRange(v as DateRangeKey)}>
        <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[170px]" aria-label="Date range">
          <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {DATE_RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {range === "custom" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="h-9 text-xs w-[140px]" />
            <span className="text-xs text-slate-400">to</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="h-9 text-xs w-[140px]" />
          </div>
          {isInvertedRange(from, to) && (
            <p role="alert" className="text-[11px] text-amber-700">The start date is after the end date, so nothing matches.</p>
          )}
        </div>
      )}
    </>
  );
}
