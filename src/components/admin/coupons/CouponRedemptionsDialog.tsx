"use client";

import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr } from "@/lib/pricing";
import { formatIstDate } from "@/lib/coupons/dates";
import type { CouponListItem, CouponRedemptionRow } from "@/lib/coupons/types";
import { describeUsage } from "./coupon-format";

interface CouponRedemptionsDialogProps {
  coupon: CouponListItem | null;
  /** null while loading. */
  rows: CouponRedemptionRow[] | null;
  onOpenChange: (open: boolean) => void;
}

export function CouponRedemptionsDialog({ coupon, rows, onOpenChange }: CouponRedemptionsDialogProps) {
  return (
    <Dialog open={!!coupon} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <History className="h-5 w-5 text-[#024AE5]" /> Usage of {coupon?.code}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {coupon && (
              <>
                {describeUsage(coupon)} uses counted · {formatInr(coupon.totalDiscount)} discounted in total.
                Cancelled orders give their use back.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {rows === null ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-400">This coupon hasn&apos;t been used yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  {["Order", "Customer", "Discount", "Use", "Date"].map((h) => (
                    <TableHead key={h} className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-600">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="text-xs">
                    <TableCell className="px-3 py-2 font-mono font-semibold text-[#024AE5]">
                      {r.orderNumber}
                      <span className="ml-1.5 font-sans text-[10px] font-normal capitalize text-slate-500">{r.orderStatus}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-slate-700">{r.companyName}</TableCell>
                    <TableCell className="px-3 py-2 font-mono">{formatInr(r.discountAmount)}</TableCell>
                    <TableCell className="px-3 py-2">
                      {r.status === "released" ? (
                        <Badge variant="secondary" title={r.releaseReason ?? undefined}>Released</Badge>
                      ) : (
                        <Badge variant="green">Counted</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-slate-500">{formatIstDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
