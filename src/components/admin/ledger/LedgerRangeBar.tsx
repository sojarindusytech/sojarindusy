"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { ledgerRangePresets } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * From / to dates for a ledger screen, kept in the URL (?from=&to=) so a statement can be
 * bookmarked or shared. Presets cover this and last financial year and month.
 */
export function LedgerRangeBar({ from, to, children }: { from: string; to: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [pending, startTransition] = useTransition();
  const presets = ledgerRangePresets();
  const preset = presets.find((p) => p.from === from && p.to === to)?.key ?? "custom";

  const go = (f: string, t: string) => {
    if (!f || !t || f > t) return;
    setDraftFrom(f);
    setDraftTo(t);
    const next = new URLSearchParams(params.toString());
    next.set("from", f);
    next.set("to", t);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const dirty = draftFrom !== from || draftTo !== to;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
      <Select value={preset} onValueChange={(k) => { const p = presets.find((x) => x.key === k); if (p) go(p.from, p.to); }}>
        <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[210px]">
          <CalendarRange className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {presets.map((p) => (<SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>))}
          <SelectItem value="custom" className="text-xs" disabled>Custom dates</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input type="date" aria-label="From date" value={draftFrom} max={draftTo || undefined} onChange={(e) => setDraftFrom(e.target.value)} className="h-9 text-xs w-[145px]" />
        <span className="text-xs text-slate-400">to</span>
        <Input type="date" aria-label="To date" value={draftTo} min={draftFrom || undefined} onChange={(e) => setDraftTo(e.target.value)} className="h-9 text-xs w-[145px]" />
        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || pending || !draftFrom || !draftTo || draftFrom > draftTo} onClick={() => go(draftFrom, draftTo)}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{children}</div>}
    </div>
  );
}
