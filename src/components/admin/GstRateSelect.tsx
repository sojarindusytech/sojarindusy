"use client";

import { GST_RATE_OPTIONS } from "@/lib/invoice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT = "__default__";

/**
 * GST % dropdown for a SKU. `value` is "" for "use the default rate from Sales
 * Settings", otherwise the rate as a string. A saved rate outside the standard
 * slabs stays selectable so editing an old SKU never silently changes it.
 */
export function GstRateSelect({
  value,
  onChange,
  defaultLabel = "Default (Sales Settings)",
}: {
  value: string;
  onChange: (value: string) => void;
  defaultLabel?: string;
}) {
  const current = value === "" ? null : Number(value);
  const rates = [...new Set<number>([...GST_RATE_OPTIONS, ...(current !== null && Number.isFinite(current) ? [current] : [])])].sort(
    (a, b) => a - b
  );

  return (
    <Select value={value === "" ? DEFAULT : value} onValueChange={(v) => onChange(v === DEFAULT ? "" : v)}>
      <SelectTrigger className="h-9 text-xs border-slate-200">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-white">
        <SelectItem value={DEFAULT} className="text-xs italic text-slate-500">{defaultLabel}</SelectItem>
        {rates.map((r) => (
          <SelectItem key={r} value={String(r)} className="text-xs">{r}%</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
