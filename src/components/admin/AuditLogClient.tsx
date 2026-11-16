"use client";

import { useMemo, useState } from "react";
import { Eye, FileDown, Search, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { AuditLogRow } from "@/actions/audit";
import type { LedgerRange } from "@/lib/server/ledger";
import { AUDIT_ENTITY_LABELS } from "@/lib/audit";
import { PageTitle } from "@/components/common/PageTitle";
import { IconAction } from "@/components/common/IconAction";
import { PaginationBar, usePagination } from "@/components/common/Pagination";
import { LoadErrorCard } from "@/components/common/LoadErrorCard";
import { LedgerRangeBar } from "@/components/admin/ledger/LedgerRangeBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUrlState } from "@/lib/use-url-state";
import { downloadCsv } from "@/lib/csv";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const entityLabel = (e: string) => AUDIT_ENTITY_LABELS[e] ?? e;

export function AuditLogClient({ range, rows, error }: { range: LedgerRange; rows: AuditLogRow[]; error: string | null }) {
  // Filters live in the URL: they survive reload / Back and can be shared as a link.
  const [search, setSearch] = useUrlState("q");
  const [entity, setEntity] = useUrlState("entity", "all");
  const [actor, setActor] = useUrlState("actor", "all");
  const [outcome, setOutcome] = useUrlState("outcome", "all");
  const [viewing, setViewing] = useState<AuditLogRow | null>(null);

  const entities = useMemo(() => [...new Set(rows.map((r) => r.entity_type))].sort((a, b) => entityLabel(a).localeCompare(entityLabel(b))), [rows]);
  const actors = useMemo(() => [...new Set(rows.map((r) => r.actor_email).filter((e): e is string => !!e))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (entity !== "all" && r.entity_type !== entity) return false;
      if (actor !== "all" && r.actor_email !== actor) return false;
      if (outcome !== "all" && r.outcome !== outcome) return false;
      if (!q) return true;
      return [r.summary, r.action, r.actor_email ?? "", r.entity_id ?? "", r.ip_address ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, search, entity, actor, outcome]);

  const pager = usePagination(filtered, `${search}|${entity}|${actor}|${outcome}|${range.from}|${range.to}`, 25);

  const failures = filtered.filter((r) => r.outcome === "failure").length;
  const people = new Set(filtered.map((r) => r.actor_id).filter(Boolean)).size;

  const exportCsv = () =>
    downloadCsv(
      `audit-log-${range.from}-to-${range.to}.csv`,
      ["When", "User", "Role", "Area", "Action", "Summary", "Record", "Outcome", "IP", "Changes"],
      filtered.map((r) => [
        r.created_at, r.actor_email ?? "", r.actor_role ?? "", entityLabel(r.entity_type), r.action, r.summary,
        r.entity_id ?? "", r.outcome, r.ip_address ?? "", r.changes ? JSON.stringify(r.changes) : "",
      ])
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle icon={ShieldAlert}>Audit Log</PageTitle>
          <p className="text-xs text-slate-500 mt-1">
            Every administrative change and sign-in, with who did it, when and from where. Entries can never be edited or deleted.
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!!error || filtered.length === 0}>
          <FileDown className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error && <LoadErrorCard message={error} />}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Events</div>
          <div className="text-xl font-bold text-slate-900">{filtered.length}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">People</div>
          <div className="text-xl font-bold text-[#024AE5]">{people}</div>
        </Card>
        <Card className="p-3.5 bg-white border border-slate-200 shadow-none rounded-xl col-span-2 lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Failed Sign-ins</div>
          <div className={`text-xl font-bold ${failures ? "text-rose-600" : "text-slate-900"}`}>{failures}</div>
        </Card>
      </div>

      <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
        <LedgerRangeBar from={range.from} to={range.to} />
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              aria-label="Search the audit log"
              placeholder="Search summary, user, record id or IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[190px]" aria-label="Area"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Areas</SelectItem>
              {entities.map((e) => (<SelectItem key={e} value={e} className="text-xs">{entityLabel(e)}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[210px]" aria-label="User"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Users</SelectItem>
              {actors.map((a) => (<SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 w-full lg:w-[140px]" aria-label="Outcome"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs">All Outcomes</SelectItem>
              <SelectItem value="success" className="text-xs">Succeeded</SelectItem>
              <SelectItem value="failure" className="text-xs">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {["When", "User", "Area", "What happened", "IP", ""].map((h) => (
                  <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    {rows.length ? "No events match your filters." : "No events recorded in this period."}
                  </TableCell>
                </TableRow>
              ) : (
                pager.pageItems.map((r) => (
                  <TableRow key={r.id} className="whitespace-nowrap">
                    <TableCell className="text-xs text-slate-600">{when(r.created_at)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-slate-800">{r.actor_email ?? (r.actor_id ? r.actor_id.slice(0, 8) : "Anonymous")}</div>
                      {r.actor_role && <div className="text-[10px] text-slate-400">{r.actor_role}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{entityLabel(r.entity_type)}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[420px]">
                      <div className="flex items-center gap-1.5">
                        {r.outcome === "failure"
                          ? <ShieldX className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        <span className="truncate text-slate-800" title={r.summary}>{r.summary}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{r.action}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">{r.ip_address ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <IconAction label="View details" onClick={() => setViewing(r)}><Eye /></IconAction>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar state={pager} noun="events" />
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{viewing?.summary}</DialogTitle>
            <DialogDescription className="text-xs">
              {viewing && `${when(viewing.created_at)} · ${viewing.actor_email ?? "Anonymous"} · ${viewing.action}`}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-xs">
              <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-slate-500">Area</dt><dd>{entityLabel(viewing.entity_type)}</dd>
                <dt className="text-slate-500">Record id</dt><dd className="font-mono break-all">{viewing.entity_id ?? "—"}</dd>
                <dt className="text-slate-500">Outcome</dt><dd>{viewing.outcome === "failure" ? "Failed" : "Succeeded"}</dd>
                <dt className="text-slate-500">IP address</dt><dd className="font-mono">{viewing.ip_address ?? "—"}</dd>
                <dt className="text-slate-500">Browser</dt><dd className="break-all text-slate-600">{viewing.user_agent ?? "—"}</dd>
              </dl>
              {viewing.changes && Object.keys(viewing.changes).length > 0 && (
                <div>
                  <p className="font-semibold text-slate-800 mb-1.5">Changes</p>
                  <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr><th className="text-left px-2 py-1.5">Field</th><th className="text-left px-2 py-1.5">Before</th><th className="text-left px-2 py-1.5">After</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(viewing.changes).map(([field, c]) => (
                        <tr key={field} className="border-t border-slate-100 align-top">
                          <td className="px-2 py-1.5 font-mono text-slate-700">{field}</td>
                          <td className="px-2 py-1.5 text-rose-700 break-all">{show(c.from)}</td>
                          <td className="px-2 py-1.5 text-emerald-700 break-all">{show(c.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
                <div>
                  <p className="font-semibold text-slate-800 mb-1.5">Details</p>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 whitespace-pre-wrap break-all text-[11px]">
                    {JSON.stringify(viewing.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
