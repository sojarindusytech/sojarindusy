import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  Layers,
  PackageX,
  RotateCcw,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserCheck,
  Users,
} from "lucide-react";
import { getDashboardData } from "@/actions/dashboard";
import { MonthlyBars } from "@/components/admin/ReportsClient";
import { LoadErrorCard } from "@/components/common/LoadErrorCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const inr0 = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Kpi({ label, value, hint, tone = "text-slate-900", href }: { label: string; value: string; hint: string; tone?: string; href?: string }) {
  const body = (
    <Card className="p-4 bg-white border border-slate-200 shadow-none rounded-xl h-full hover:border-[#024AE5]/40 transition-colors">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function Task({ icon: Icon, label, count, href, urgent }: { icon: ComponentType<{ className?: string }>; label: string; count: number | null; href: string; urgent?: boolean }) {
  const active = (count ?? 0) > 0;
  return (
    <Link href={href} className="group">
      <Card className={`p-3 shadow-none rounded-xl border transition-colors ${active ? (urgent ? "border-rose-200 bg-rose-50/40" : "border-amber-200 bg-amber-50/40") : "border-slate-200 bg-white"} group-hover:border-[#024AE5]/50`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-4 w-4 shrink-0 ${active ? (urgent ? "text-rose-600" : "text-amber-600") : "text-slate-400"}`} />
            <span className="text-xs font-semibold text-slate-800 truncate">{label}</span>
          </div>
          <span className={`text-lg font-bold ${active ? "text-slate-900" : "text-slate-400"}`}>{count ?? "—"}</span>
        </div>
      </Card>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // The admin layout already sends non-admins away; the loader checks again (one lookup, not three).
  const { attention: a, thisMonth, months, receivables: ageing, recentOrders, warnings } = await getDashboardData();

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#024AE5] to-[#013bb8] p-6 text-white">
        <div className="space-y-1.5">
          <Badge className="bg-[#3C8B4F] text-white border-0 text-[11px]">
            <ShieldCheck className="h-3 w-3 mr-1" /> Platform Owner Console
          </Badge>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight">
            <LayoutDashboard className="h-6 w-6 shrink-0" />
            <span>Dashboard</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/products?upload=true">
            <Button size="sm" className="bg-white text-[#024AE5] hover:bg-slate-100 text-xs font-semibold gap-1.5 shadow-none">
              <UploadCloud className="h-4 w-4" />
              <span>Upload Products</span>
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button size="sm" variant="outline" className="text-xs border-white/30 text-white bg-white/10 hover:bg-white/20 shadow-none gap-1.5">
              <BarChart3 className="h-4 w-4" /> Reports
            </Button>
          </Link>
        </div>
      </div>

      {warnings.map((w) => <LoadErrorCard key={w} message={w} />)}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Sales this month" value={inr0(thisMonth.net)} hint={`${thisMonth.invoices} invoices · net of credit notes`} tone="text-[#024AE5]" href="/admin/invoices?range=this_month" />
        <Kpi label="Collected this month" value={thisMonth.collected === null ? "—" : inr0(thisMonth.collected)} hint="payments received" tone="text-emerald-700" href="/admin/payments-received?range=this_month" />
        <Kpi label="Receivable" value={ageing ? inr0(ageing.due) : "—"} hint="owed by customers today" href="/admin/party-ledger" />
        <Kpi label="Overdue" value={ageing ? inr0(ageing.overdue) : "—"} hint="past their credit days" tone={ageing && ageing.overdue > 0 ? "text-rose-600" : "text-slate-900"} href="/admin/reports#ageing" />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-2">Needs attention</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Task icon={ClipboardList} label="Orders to process" count={a.ordersToProcess} href="/admin/orders" />
          <Task icon={Truck} label="Orders in transit" count={a.ordersInTransit} href="/admin/orders" />
          <Task icon={RotateCcw} label="Return requests" count={a.returnRequests} href="/admin/order-returns" urgent />
          <Task icon={UserCheck} label="Customers to approve" count={a.customersPending} href="/admin/customers" />
          <Task icon={PackageX} label="Low-stock SKUs" count={a.lowStock} href="/admin/reports#low-stock" urgent />
          <Task icon={Factory} label="Open purchase orders" count={a.openPurchaseOrders} href="/admin/purchase-orders" />
          <Task icon={Layers} label="RFQs to answer" count={a.rfqsOpen} href="/admin/rfqs" />
          <Task icon={Inbox} label="Unread inquiries" count={a.inquiriesUnread} href="/admin/inquiries" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <Card className="bg-white border border-slate-200 shadow-none rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900">Net sales, last 6 months</h2>
            <Link href="/admin/reports" className="text-xs text-[#024AE5] hover:underline flex items-center gap-1">Full report <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          {months.every((m) => m.invoices === 0 && m.net === 0) ? (
            <p className="text-xs text-slate-500 py-10 text-center">No invoices in the last six months.</p>
          ) : (
            <div className="pb-6"><MonthlyBars months={months} /></div>
          )}
        </Card>

        <Card className="bg-white border border-slate-200 shadow-none rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs text-[#024AE5] hover:underline flex items-center gap-1">All orders <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">
              {warnings.includes("Recent orders could not be loaded.") ? "Recent orders could not be loaded." : "No orders yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Order</TableHead>
                  <TableHead className="text-[11px]">Customer</TableHead>
                  <TableHead className="text-[11px] text-right">Amount</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => {
                  const cfg = ORDER_STATUS_CONFIG[o.status as OrderStatus];
                  return (
                    <TableRow key={o.id} className="whitespace-nowrap">
                      <TableCell className="text-xs">
                        <div className="font-mono font-semibold text-[#024AE5]">{o.order_number}</div>
                        <div className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate" title={o.company}>{o.company}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{inr0(o.total_amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg?.badgeBg ?? ""} ${cfg?.badgeText ?? ""} ${cfg?.border ?? ""}`}>
                          {cfg?.label ?? o.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {ageing && ageing.topOverdue.length > 0 && (
        <Card className="bg-white border border-rose-200 shadow-none rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" /> Most overdue customers
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {ageing.topOverdue.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/admin/party-ledger/${c.id}`} className="rounded-lg border border-slate-200 p-2.5 hover:border-[#024AE5]/50">
                <div className="text-xs font-semibold text-slate-800 truncate">{c.name}</div>
                <div className="text-[11px] text-rose-600">{inr0(c.overdue)} overdue</div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/admin/customers", label: "Customers", icon: Users },
          { href: "/admin/invoices", label: "Invoices", icon: FileSpreadsheet },
          { href: "/admin/orders", label: "Orders", icon: ClipboardList },
          { href: "/admin/audit-logs", label: "Audit Log", icon: ShieldCheck },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="border-slate-200 bg-white hover:border-[#024AE5] transition-all p-3 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[#024AE5]" />
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-[#024AE5]">{label}</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#024AE5]" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
