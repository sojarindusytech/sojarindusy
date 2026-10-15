"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { adminUpdateCustomer, type AdminCustomerUpdate } from "@/actions/customer";
import { INDIAN_STATES, USER_TITLES, USER_TYPES, type UserTitle } from "@/lib/constants";
import type { Profile } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const NO_SPINNER = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Admin edit of a customer's details. The parent mounts it only while open, so state starts from the customer. */
export function CustomerEditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Profile;
  onClose: () => void;
  onSaved: (customer: Profile) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<AdminCustomerUpdate>({
    title: (customer.title as UserTitle) ?? USER_TITLES[0],
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    company_name: customer.company_name ?? "",
    designation: customer.designation ?? "",
    department: customer.department ?? "",
    mobile: customer.mobile ?? "",
    landline: customer.landline ?? "",
    gstin: customer.gstin ?? "",
    company_address: customer.company_address ?? "",
    additional_address: customer.additional_address ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    pincode: customer.pincode ?? "",
    credit_limit: customer.credit_limit == null ? "" : String(customer.credit_limit),
    credit_days: customer.credit_days == null ? "" : String(customer.credit_days),
    notes: customer.notes ?? "",
  });
  const set = <K extends keyof AdminCustomerUpdate>(k: K, value: AdminCustomerUpdate[K]) => setV((p) => ({ ...p, [k]: value }));
  const isOffline = customer.user_type === USER_TYPES.OFFLINE_USER;

  const text = (k: keyof AdminCustomerUpdate, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={v[k]} onChange={(e) => set(k, e.target.value as never)} className="h-9 text-xs" {...props} />
    </div>
  );

  const save = () =>
    startTransition(async () => {
      try {
        const res = await adminUpdateCustomer(customer.id, v);
        if (res.success && res.customer) {
          toast.success(`${v.company_name} updated.`);
          onSaved(res.customer);
        } else {
          toast.error(res.error || "Failed to save the changes.");
        }
      } catch (err) {
        // A thrown server action (expired session, network) must not look like "nothing happened".
        console.error("[CustomerEditModal] save failed:", err);
        toast.error("Could not reach the server. Reload the page and try again.");
      }
    });

  // A saved state outside the standard list (older data) stays selectable.
  const states = INDIAN_STATES.includes(v.state as never) || !v.state ? [...INDIAN_STATES] : [v.state, ...INDIAN_STATES];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 w-[calc(100%-2rem)] max-w-3xl h-[85vh] max-h-[calc(100vh-2rem)] overflow-hidden">
        <DialogHeader className="shrink-0 pb-3">
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update the details for {customer.company_name}. The login email, account type and approval status are not changed here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-3 pr-1">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact person</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Select value={v.title} onValueChange={(t) => set("title", t as UserTitle)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {USER_TITLES.map((t) => (<SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {text("first_name", "First name *")}
              {text("last_name", "Last name *")}
              {text("designation", "Designation")}
              {text("department", "Department")}
              {text("mobile", "Mobile *", { inputMode: "tel" })}
              {text("landline", "Landline")}
              <div className="space-y-1.5">
                <Label className="text-xs">Email (login)</Label>
                <Input value={customer.email ?? ""} readOnly disabled className="h-9 text-xs bg-slate-50" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Company</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {text("company_name", "Company name *")}
              {text("gstin", "GSTIN", { maxLength: 15, className: "h-9 text-xs uppercase" })}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address *</Label>
              <Textarea rows={2} value={v.company_address} onChange={(e) => set("company_address", e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional address</Label>
              <Textarea rows={2} value={v.additional_address} onChange={(e) => set("additional_address", e.target.value)} className="text-xs" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {text("city", "City *")}
              <div className="space-y-1.5">
                <Label className="text-xs">State *</Label>
                <Select value={v.state} onValueChange={(s) => set("state", s)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">
                    {states.map((s) => (<SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {text("pincode", "Pincode *", { inputMode: "numeric" })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Credit terms {isOffline ? "" : "(online customers are prepaid unless set)"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {text("credit_limit", "Credit limit (₹)", { type: "number", min: 0, step: "1", placeholder: "No credit", className: `h-9 text-xs ${NO_SPINNER}` })}
              {text("credit_days", "Credit days", { type: "number", min: 0, step: "1", placeholder: "0", className: `h-9 text-xs ${NO_SPINNER}` })}
            </div>
          </section>

          <section className="space-y-1.5">
            <Label className="text-xs">Internal notes</Label>
            <Textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} className="text-xs" />
          </section>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
