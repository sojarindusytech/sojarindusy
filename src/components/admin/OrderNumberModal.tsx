"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { renameOrderNumber } from "@/actions/order";
import type { Order } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

/** Give an order a typed number. The parent mounts it only while open. */
export function OrderNumberModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (orderId: string, newNumber: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(order.order_number);
  const changed = value.trim() !== order.order_number;

  const save = () =>
    startTransition(async () => {
      try {
        const res = await renameOrderNumber(order.id, value);
        if (res.success) {
          toast.success(res.orderNumber === order.order_number ? "Order number unchanged." : `Order is now ${res.orderNumber}.`);
          onSaved(order.id, res.orderNumber);
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        console.error("[OrderNumberModal] save failed:", err);
        toast.error("Could not reach the server. Reload the page and try again.");
      }
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Order Number</DialogTitle>
          <DialogDescription>
            New orders are numbered automatically from Sales Settings. Use this to give this one order a different number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Order number</Label>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changed && !pending && save()}
            className="h-9 text-sm font-mono"
            maxLength={50}
          />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Letters, numbers and / - _ . only, up to 50 characters, and it must be unique. The automatic counter doesn&apos;t move.
            The customer sees the new number everywhere; earlier stock-log entries and notifications keep the number they were written with.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending || !changed || value.trim() === ""}>{pending ? "Saving..." : "Save Number"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
