"use client";

import { PageTitle } from "@/components/common/PageTitle";
import { useMemo, useState, useTransition } from "react";
import { History, Pencil, Plus, Power, Search, TicketPercent, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteCouponAction,
  fetchCouponForEdit,
  fetchCouponRedemptions,
  fetchCouponsList,
  setCouponActiveAction,
} from "@/actions/coupon";
import { Badge } from "@/components/ui/badge";
import { IconAction } from "@/components/common/IconAction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatInr } from "@/lib/pricing";
import { todayIst } from "@/lib/coupons/dates";
import { COUPON_STATUS_CONFIG, type CouponStatus } from "@/lib/coupons/status";
import type { CouponFormOptions, CouponListItem, CouponRedemptionRow } from "@/lib/coupons/types";
import { CouponFormDialog } from "./CouponFormDialog";
import { CouponRedemptionsDialog } from "./CouponRedemptionsDialog";
import { couponFormFromData, emptyCouponForm, type CouponFormState } from "./coupon-form-state";
import { describeDiscount, describePerCustomer, describeScope, describeUsage, describeValidity } from "./coupon-format";

type StatusFilter = "current" | CouponStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "current", label: "All (not archived)" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "used_up", label: "Used up" },
  { value: "expired", label: "Expired" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" },
];

interface CouponManagementClientProps {
  initialCoupons: CouponListItem[];
  options: CouponFormOptions;
}

export function CouponManagementClient({ initialCoupons, options }: CouponManagementClientProps) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("current");
  const [isPending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<CouponFormState | null>(null);
  const [formHasUses, setFormHasUses] = useState(false);

  const [historyCoupon, setHistoryCoupon] = useState<CouponListItem | null>(null);
  const [historyRows, setHistoryRows] = useState<CouponRedemptionRow[] | null>(null);

  const [deleting, setDeleting] = useState<CouponListItem | null>(null);

  const refresh = () =>
    startTransition(async () => {
      setCoupons(await fetchCouponsList());
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coupons.filter((c) => {
      const statusOk = statusFilter === "current" ? !c.isArchived : c.status === statusFilter;
      const queryOk = !q || c.code.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      return statusOk && queryOk;
    });
  }, [coupons, query, statusFilter]);

  // Cards follow the search and status filters.
  const stats = useMemo(() => {
    const current = visible.filter((c) => !c.isArchived);
    return {
      active: current.filter((c) => c.status === "active").length,
      scheduled: current.filter((c) => c.status === "scheduled").length,
      uses: visible.reduce((sum, c) => sum + c.activeUses, 0),
      discount: visible.reduce((sum, c) => sum + c.totalDiscount, 0),
    };
  }, [visible]);

  const openCreate = () => {
    setFormHasUses(false);
    setFormInitial(emptyCouponForm(todayIst()));
    setFormOpen(true);
  };

  const openEdit = (coupon: CouponListItem) => {
    setFormHasUses(coupon.activeUses + coupon.releasedUses > 0);
    setFormInitial(null);
    setFormOpen(true);
    startTransition(async () => {
      const data = await fetchCouponForEdit(coupon.id);
      if (!data) {
        toast.error("This coupon could not be loaded. It may have been deleted.");
        setFormOpen(false);
        refresh();
        return;
      }
      setFormInitial(couponFormFromData(data));
    });
  };

  const openHistory = (coupon: CouponListItem) => {
    setHistoryRows(null);
    setHistoryCoupon(coupon);
    startTransition(async () => {
      setHistoryRows(await fetchCouponRedemptions(coupon.id));
    });
  };

  const toggleActive = (coupon: CouponListItem) =>
    startTransition(async () => {
      const res = await setCouponActiveAction(coupon.id, !coupon.isActive);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${coupon.code} ${coupon.isActive ? "disabled" : "enabled"}.`);
      setCoupons(await fetchCouponsList());
    });

  const confirmDelete = () => {
    const coupon = deleting;
    if (!coupon) return;
    startTransition(async () => {
      const res = await deleteCouponAction(coupon.id);
      setDeleting(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message, { duration: res.outcome === "archived" ? 7000 : 4000 });
      setCoupons(await fetchCouponsList());
    });
  };

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageTitle icon={TicketPercent}>Coupons</PageTitle>
        </div>
        <Button size="sm" onClick={openCreate} className="h-9 gap-2 px-4 text-xs font-bold">
          <Plus className="h-4 w-4 stroke-[2.5]" /> Create coupon
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active now" value={String(stats.active)} />
        <Stat label="Scheduled" value={String(stats.scheduled)} />
        <Stat label="Uses counted" value={String(stats.uses)} />
        <Stat label="Total discount given" value={formatInr(stats.discount)} />
      </div>

      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by code or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 border-slate-200 bg-slate-50/60 pl-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="border-b border-slate-200 bg-slate-50/80">
              <TableRow className="border-0">
                {["Code", "Discount", "Validity", "Uses", "Status", ""].map((h, i) => (
                  <TableHead
                    key={h || i}
                    className={`px-3.5 py-2.5 text-[11px] font-semibold uppercase text-slate-600 ${i === 5 ? "text-right" : ""}`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    {coupons.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <TicketPercent className="h-6 w-6 text-slate-300" />
                        No coupons yet. Create one to offer a discount at checkout.
                      </span>
                    ) : (
                      "No coupons match this search."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c) => {
                  const status = COUPON_STATUS_CONFIG[c.status];
                  return (
                    <TableRow key={c.id} className="border-b border-slate-100 text-xs hover:bg-slate-50">
                      <TableCell className="px-3.5 py-3 align-top">
                        <p className="font-mono text-sm font-bold text-slate-900">{c.code}</p>
                        {c.description && <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-slate-500">{c.description}</p>}
                        <p className="mt-0.5 text-[11px] text-slate-400">{describeScope(c)}</p>
                      </TableCell>
                      <TableCell className="px-3.5 py-3 align-top">
                        <p className="font-semibold text-slate-800">{describeDiscount(c)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {c.minOrderValue > 0 ? `Min. order ${formatInr(c.minOrderValue)}` : "No minimum"}
                        </p>
                      </TableCell>
                      <TableCell className="px-3.5 py-3 align-top text-slate-700">{describeValidity(c)}</TableCell>
                      <TableCell className="px-3.5 py-3 align-top">
                        <p className="font-mono font-semibold text-slate-800">{describeUsage(c)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{describePerCustomer(c.maxUsesPerCustomer)}</p>
                      </TableCell>
                      <TableCell className="px-3.5 py-3 align-top">
                        <Badge variant={status.badgeVariant} title={status.description}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-3 text-right align-top">
                        <div className="inline-flex gap-1">
                          <IconButton label="Usage history" onClick={() => openHistory(c)} icon={History} />
                          {!c.isArchived && (
                            <>
                              <IconButton label="Edit" onClick={() => openEdit(c)} icon={Pencil} disabled={isPending} />
                              <IconButton
                                label={c.isActive ? "Disable" : "Enable"}
                                onClick={() => toggleActive(c)}
                                icon={Power}
                                disabled={isPending}
                                className={c.isActive ? "text-emerald-600" : "text-slate-400"}
                              />
                              <IconButton
                                label="Delete"
                                onClick={() => setDeleting(c)}
                                icon={Trash2}
                                disabled={isPending}
                                className="text-rose-500 hover:text-rose-700"
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CouponFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formInitial}
        options={options}
        hasUses={formHasUses}
        onSaved={refresh}
      />

      <CouponRedemptionsDialog
        coupon={historyCoupon}
        rows={historyRows}
        onOpenChange={(open) => !open && setHistoryCoupon(null)}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.activeUses + deleting.releasedUses > 0
                ? "It has been used on orders, so it will be archived instead: customers can no longer use it, and past orders keep their discount record."
                : "It has never been used, so it will be deleted permanently."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending} className="bg-red-600 hover:bg-red-700">
              {deleting && deleting.activeUses + deleting.releasedUses > 0 ? "Archive coupon" : "Delete coupon"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  icon: Icon,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <IconAction label={label} onClick={onClick} disabled={disabled} className={className}>
      <Icon />
    </IconAction>
  );
}
