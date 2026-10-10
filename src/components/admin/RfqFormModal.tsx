"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { createManualRfq } from "@/actions/rfq";
import { getInvoiceFormData, type InvoiceFormCustomer } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const CUSTOM = "__custom__";

/** Record an RFQ on a customer's behalf. The parent mounts it only while open. */
export function RfqFormModal({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [customers, setCustomers] = useState<InvoiceFormCustomer[]>([]);
  const [customerId, setCustomerId] = useState(CUSTOM);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [specs, setSpecs] = useState("");
  const [manual, setManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");

  useEffect(() => {
    let cancelled = false;
    getInvoiceFormData().then((d) => { if (!cancelled) setCustomers(d.customers); });
    return () => { cancelled = true; };
  }, []);

  const pick = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setCompany(c.company_name); setContact(c.contact_name); setEmail(c.email); setMobile(c.mobile);
  };

  const submit = () =>
    startTransition(async () => {
      const res = await createManualRfq({
        customerId: customerId === CUSTOM ? null : customerId,
        company_name: company,
        contact_person: contact,
        email,
        mobile,
        item_name: item,
        quantity,
        required_by_date: requiredBy || null,
        specifications: specs,
        manualNumber: manual ? manualNumber : null,
      });
      if (res.success && res.rfq) {
        toast.success(`RFQ ${res.rfq.rfq_number} created.`);
        onCreated();
      } else {
        toast.error(res.error || "Failed to create RFQ.");
      }
    });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New RFQ</DialogTitle>
          <DialogDescription>Record a request for quotation received by phone, email or in person.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={(v) => (v === CUSTOM ? setCustomerId(CUSTOM) : pick(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                <SelectItem value={CUSTOM} className="text-xs italic">Walk-in / enter details manually</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">A selected customer also sees this RFQ in their dashboard.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Company *</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact person</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile</Label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Product / tooling *</Label>
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Carbide end mill 12mm, 4 flute" className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Quantity *</Label>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 50 pcs" className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Required by</Label>
            <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Specifications</Label>
            <Textarea rows={3} value={specs} onChange={(e) => setSpecs(e.target.value)} className="text-xs" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-[#024AE5]" />
              Enter RFQ number manually
            </label>
            {manual ? (
              <Input placeholder="e.g. SI/RFQ/25-26/04" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="h-9 text-xs font-mono" />
            ) : (
              <p className="text-[11px] text-slate-500">The next number from Sales Settings is assigned automatically.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Creating..." : "Create RFQ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
