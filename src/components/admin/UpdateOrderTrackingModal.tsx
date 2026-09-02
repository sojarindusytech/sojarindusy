"use client";

import { useState, useEffect } from "react";
import { Order } from "@/types/database.types";
import { updateOrderStatus } from "@/actions/order";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
  COURIER_PARTNERS,
} from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  ExternalLink,
  Loader2,
  PackageCheck,
  CheckCircle2,
  Clock,
  Ban,
  Building2,
} from "lucide-react";
import toast from "react-hot-toast";

interface UpdateOrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess?: (updatedFields: {
    status: OrderStatus;
    courier_partner?: string;
    awb_number?: string;
    tracking_url?: string;
    notes?: string;
  }) => void;
}

export function UpdateOrderTrackingModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: UpdateOrderTrackingModalProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status || ORDER_STATUSES.PENDING);
  const [courierPartner, setCourierPartner] = useState<string>(order.courier_partner || "");
  const [awbNumber, setAwbNumber] = useState<string>(order.awb_number || "");
  const [trackingUrl, setTrackingUrl] = useState<string>(order.tracking_url || "");
  const [notes, setNotes] = useState<string>(order.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setStatus(order.status || ORDER_STATUSES.PENDING);
      setCourierPartner(order.courier_partner || "");
      setAwbNumber(order.awb_number || "");
      setTrackingUrl(order.tracking_url || "");
      setNotes(order.notes || "");
    }
  }, [order]);

  // Auto-generate tracking URL when courier partner or AWB changes if applicable
  const handleAwbChange = (awb: string) => {
    setAwbNumber(awb);
    if (courierPartner && awb.trim()) {
      const partner = COURIER_PARTNERS.find((p) => p.name === courierPartner);
      if (partner?.urlTemplate) {
        setTrackingUrl(`${partner.urlTemplate}${awb.trim()}`);
      }
    }
  };

  const handleCourierSelect = (courierName: string) => {
    setCourierPartner(courierName);
    if (awbNumber.trim()) {
      const partner = COURIER_PARTNERS.find((p) => p.name === courierName);
      if (partner?.urlTemplate) {
        setTrackingUrl(`${partner.urlTemplate}${awbNumber.trim()}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await updateOrderStatus(order.id, status, {
      courier_partner: courierPartner,
      awb_number: awbNumber,
      tracking_url: trackingUrl,
      notes,
    });

    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Order #${order.order_number} status updated to ${
          ORDER_STATUS_CONFIG[status]?.label || status
        }`
      );
      onSuccess?.({
        status,
        courier_partner: courierPartner || undefined,
        awb_number: awbNumber || undefined,
        tracking_url: trackingUrl || undefined,
        notes: notes || undefined,
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#024AE5]" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Order Lifecycle & Tracking
              </DialogTitle>
            </div>
            <span className="font-mono text-xs font-bold text-[#024AE5] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              #{order.order_number}
            </span>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Manually update the fulfillment status and assign courier tracking details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Customer Summary Banner */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Client Account</span>
              <span className="font-bold text-slate-800">
                {order.customer_details?.company_name || "B2B Client"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Value</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{order.total_amount?.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Order Progression Stage *</Label>
            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-white shadow-none">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                <SelectItem value={ORDER_STATUSES.PENDING}>
                  ⏳ Pending Review (Order Placed)
                </SelectItem>
                <SelectItem value={ORDER_STATUSES.CONFIRMED}>
                  ✅ Confirmed (Stock Allocated)
                </SelectItem>
                <SelectItem value={ORDER_STATUSES.PROCESSING}>
                  📦 Processing / Packaging (Warehouse)
                </SelectItem>
                <SelectItem value={ORDER_STATUSES.SHIPPED}>
                  🚚 Shipped / In Transit (Carrier Dispatched)
                </SelectItem>
                <SelectItem value={ORDER_STATUSES.DELIVERED}>
                  🎉 Delivered (Completed)
                </SelectItem>
                <SelectItem value={ORDER_STATUSES.CANCELLED}>
                  ❌ Cancelled (Restock Inventory)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logistics & Tracking Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-slate-600" />
              <Label className="text-xs font-bold text-slate-800">
                Logistics & Carrier Details
              </Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-600">Courier Partner</Label>
                <Select value={courierPartner} onValueChange={handleCourierSelect}>
                  <SelectTrigger className="h-8 text-xs border-slate-200 bg-white shadow-none">
                    <SelectValue placeholder="Choose Carrier" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 shadow-lg text-xs">
                    {COURIER_PARTNERS.map((cp) => (
                      <SelectItem key={cp.name} value={cp.name} className="text-xs">
                        {cp.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other Logistics" className="text-xs">Other / Direct Truck</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-600">AWB / Consignment #</Label>
                <Input
                  type="text"
                  placeholder="e.g. BD-982138942"
                  value={awbNumber}
                  onChange={(e) => handleAwbChange(e.target.value)}
                  className="h-8 text-xs font-mono border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600">Live Tracking Link / URL</Label>
              <Input
                type="url"
                placeholder="https://www.bluedart.com/tracking?track=..."
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="h-8 text-xs font-mono border-slate-200"
              />
            </div>
          </div>

          {/* Internal Fulfillment Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Dispatch / Status Notes</Label>
            <Textarea
              placeholder="e.g. Handed over to Blue Dart courier van, 3 boxes with wooden strapping..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px] border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs border-slate-200 shadow-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-8 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-bold shadow-none cursor-pointer gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>Save & Update Status</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
