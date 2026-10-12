"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Loader2, Shuffle, TicketPercent } from "lucide-react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveCouponAction } from "@/actions/coupon";
import { couponFormSchema, fieldErrors, generateCouponCode } from "@/lib/coupons/schema";
import type { CouponFormOptions } from "@/lib/coupons/types";
import { couponFormToInput, type CouponFormState } from "./coupon-form-state";
import { SearchableChecklist, type ChecklistItem } from "./SearchableChecklist";

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null while an existing coupon is loading. */
  initial: CouponFormState | null;
  options: CouponFormOptions;
  /** True when the coupon has already been used on orders. */
  hasUses?: boolean;
  onSaved: () => void;
}

export function CouponFormDialog({ open, onOpenChange, initial, options, hasUses, onSaved }: CouponFormDialogProps) {
  const isEdit = !!initial?.id;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <TicketPercent className="h-5 w-5 text-[#024AE5]" />
            {isEdit ? `Edit coupon ${initial?.code}` : "Create coupon"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Dates are whole days in India time. The discount comes off the order before GST.
          </DialogDescription>
        </DialogHeader>
        {initial ? (
          // Keyed so reopening for another coupon starts from fresh state.
          <CouponForm
            key={initial.id ?? "new"}
            initial={initial}
            options={options}
            hasUses={hasUses}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading coupon…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CouponForm({
  initial,
  options,
  hasUses,
  onCancel,
  onSaved,
}: {
  initial: CouponFormState;
  options: CouponFormOptions;
  hasUses?: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CouponFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  // The submit button is at the bottom of a long form: bring the error summary into view.
  const showFormError = (message: string) => {
    setFormError(message);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const set = <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const productItems: ChecklistItem[] = useMemo(
    () => options.products.map((p) => ({ id: p.id, label: p.title, sublabel: p.isActive ? undefined : "Inactive", muted: !p.isActive })),
    [options.products]
  );
  const categoryItems: ChecklistItem[] = useMemo(
    () => options.categories.map((c) => ({ id: c.id, label: c.name, depth: c.depth })),
    [options.categories]
  );
  const customerItems: ChecklistItem[] = useMemo(
    () => options.customers.map((c) => ({ id: c.id, label: c.companyName, sublabel: `${c.contactName} · ${c.email}` })),
    [options.customers]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const input = couponFormToInput(form);
    const parsed = couponFormSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      showFormError("Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const res = await saveCouponAction(input);
      if (!res.success) {
        setErrors(res.fieldErrors ?? {});
        showFormError(res.error);
        return;
      }
      toast.success(res.message);
      onSaved();
    });
  };

  const isPercent = form.discountType === "percent";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6">
      <div ref={topRef} />
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p>{formError}</p>
        </div>
      )}
      {hasUses && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          This coupon has already been used. Changes apply to new orders only; past orders keep the discount they got.
        </p>
      )}

      <Section title="Coupon">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" required error={errors.code} htmlFor="coupon-code">
            <div className="flex gap-2">
              <Input
                id="coupon-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. DIWALI10"
                maxLength={32}
                autoComplete="off"
                className="h-9 font-mono text-xs uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("code", generateCouponCode())}
                className="h-9 shrink-0 text-xs"
                title="Generate a random code"
              >
                <Shuffle className="h-3.5 w-3.5" /> Generate
              </Button>
            </div>
          </Field>
          <Field label="Description (shown to customers)" error={errors.description} htmlFor="coupon-description">
            <Input
              id="coupon-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Festive offer on end mills"
              maxLength={500}
              className="h-9 text-xs"
            />
          </Field>
        </div>
        <Checkbox
          checked={form.isActive}
          onChange={(v) => set("isActive", v)}
          label="Active"
          hint="Turn off to pause the coupon without deleting it."
        />
      </Section>

      <Section title="Discount">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discount type" required>
            <Select value={form.discountType} onValueChange={(v) => set("discountType", v as CouponFormState["discountType"])}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed amount (₹)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={isPercent ? "Discount (%)" : "Discount (₹)"} required error={errors.discountValue} htmlFor="coupon-value">
            <NumberInput
              id="coupon-value"
              value={form.discountValue}
              onChange={(v) => set("discountValue", v)}
              placeholder={isPercent ? "e.g. 10" : "e.g. 500"}
              invalid={!!errors.discountValue}
            />
          </Field>
          {isPercent && (
            <Field label="Maximum discount (₹)" hint="Leave empty for no cap." error={errors.maxDiscount} htmlFor="coupon-max">
              <NumberInput
                id="coupon-max"
                value={form.maxDiscount}
                onChange={(v) => set("maxDiscount", v)}
                placeholder="No cap"
                invalid={!!errors.maxDiscount}
              />
            </Field>
          )}
          <Field label="Minimum order value (₹, before GST)" hint="0 means no minimum." error={errors.minOrderValue} htmlFor="coupon-min">
            <NumberInput
              id="coupon-min"
              value={form.minOrderValue}
              onChange={(v) => set("minOrderValue", v)}
              invalid={!!errors.minOrderValue}
            />
          </Field>
        </div>
      </Section>

      <Section title="Validity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valid from" required error={errors.validFrom} htmlFor="coupon-from">
            <Input
              id="coupon-from"
              type="date"
              value={form.validFrom}
              onChange={(e) => set("validFrom", e.target.value)}
              className="h-9 text-xs"
            />
          </Field>
          <Field label="Valid until" hint="Leave empty for no end date." error={errors.validUntil} htmlFor="coupon-until">
            <Input
              id="coupon-until"
              type="date"
              value={form.validUntil}
              min={form.validFrom || undefined}
              onChange={(e) => set("validUntil", e.target.value)}
              className="h-9 text-xs"
            />
          </Field>
        </div>
      </Section>

      <Section title="Usage limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total uses" error={errors.maxTotalUses} htmlFor="coupon-total">
            <div className="flex gap-2">
              <Select value={form.totalLimit} onValueChange={(v) => set("totalLimit", v as CouponFormState["totalLimit"])}>
                <SelectTrigger className="h-9 w-36 shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="limited">Limited to</SelectItem>
                </SelectContent>
              </Select>
              {form.totalLimit === "limited" && (
                <NumberInput
                  id="coupon-total"
                  value={form.maxTotalUses}
                  onChange={(v) => set("maxTotalUses", v)}
                  placeholder="e.g. 100"
                  integer
                  invalid={!!errors.maxTotalUses}
                />
              )}
            </div>
          </Field>
          <Field label="Uses per customer" error={errors.maxUsesPerCustomer} htmlFor="coupon-per-customer">
            <div className="flex gap-2">
              <Select value={form.perCustomer} onValueChange={(v) => set("perCustomer", v as CouponFormState["perCustomer"])}>
                <SelectTrigger className="h-9 w-36 shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="once">One time</SelectItem>
                  <SelectItem value="custom">Multiple, up to</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
              {form.perCustomer === "custom" && (
                <NumberInput
                  id="coupon-per-customer"
                  value={form.maxUsesPerCustomer}
                  onChange={(v) => set("maxUsesPerCustomer", v)}
                  placeholder="e.g. 3"
                  integer
                  invalid={!!errors.maxUsesPerCustomer}
                />
              )}
            </div>
          </Field>
        </div>
        <Checkbox
          checked={form.firstOrderOnly}
          onChange={(v) => set("firstOrderOnly", v)}
          label="First order only"
          hint="Only customers with no earlier (non-cancelled) order can use it."
        />
      </Section>

      <Section title="Who and what it applies to">
        <Field label="Products">
          <Segmented
            value={form.appliesTo}
            onChange={(v) => set("appliesTo", v)}
            options={[
              { value: "all", label: "Whole cart" },
              { value: "products", label: "Selected products" },
              { value: "categories", label: "Selected categories" },
            ]}
          />
        </Field>
        {form.appliesTo === "products" && (
          <Field error={errors.productIds} hint="The discount is worked out on these products only.">
            <SearchableChecklist
              items={productItems}
              selectedIds={form.productIds}
              onChange={(ids) => set("productIds", ids)}
              searchPlaceholder="Search products…"
              emptyText="No products found."
              invalid={!!errors.productIds}
            />
          </Field>
        )}
        {form.appliesTo === "categories" && (
          <Field error={errors.categoryIds} hint="A category includes all of its sub-categories.">
            <SearchableChecklist
              items={categoryItems}
              selectedIds={form.categoryIds}
              onChange={(ids) => set("categoryIds", ids)}
              searchPlaceholder="Search categories…"
              emptyText="No categories found."
              invalid={!!errors.categoryIds}
            />
          </Field>
        )}

        <Field label="Customers">
          <Segmented
            value={form.customerScope}
            onChange={(v) => set("customerScope", v)}
            options={[
              { value: "all", label: "All approved customers" },
              { value: "selected", label: "Selected customers" },
            ]}
          />
        </Field>
        {form.customerScope === "selected" && (
          <Field error={errors.customerIds} hint="Other customers are told the code isn't valid.">
            <SearchableChecklist
              items={customerItems}
              selectedIds={form.customerIds}
              onChange={(ids) => set("customerIds", ids)}
              searchPlaceholder="Search by company, name or email…"
              emptyText="No approved customers found."
              invalid={!!errors.customerIds}
            />
          </Field>
        )}

        <Checkbox
          checked={form.canCombine}
          onChange={(v) => set("canCombine", v)}
          label="Can be combined with other discounts"
          hint="One coupon per order. There are no other automatic discounts yet; when there are, this decides whether they stack."
        />
      </Section>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending} className="px-6">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {initial.id ? "Save changes" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}

// ---- small form building blocks ----------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-slate-500">{hint}</p>
      )}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  integer,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  integer?: boolean;
  invalid?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode={integer ? "numeric" : "decimal"}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || (integer ? /^\d*$/ : /^\d*\.?\d{0,2}$/).test(v)) onChange(v);
      }}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      className={cn("h-9 text-xs", invalid && "border-rose-300")}
    />
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#024AE5]"
      />
      <span>
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === opt.value ? "bg-white text-[#024AE5] shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
