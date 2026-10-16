import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ current: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ requireAdmin: async () => ({ userId: "admin" }) }));
vi.mock("@/lib/sales-settings", () => ({ loadSalesSettings: mocks.current }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ update: mocks.update }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateSalesSettings } from "@/actions/sales-settings";
import { salesSettingsSchema, type SalesSettingsInput } from "@/lib/validations/sales-settings";
import { financialYear } from "@/lib/invoice";
const valid: SalesSettingsInput = {
  company_name: "Sojar", address: "Vapi, Gujarat", gstin: null, state_code: "24", state_name: "Gujarat", email: null,
  invoice_reduces_stock: true, credit_note_restores_stock: true,
  gst_billing_enabled: true, default_gst_rate: 18,
  invoice_prefix: "SI/INV", invoice_next_number: 1, invoice_pad: 2,
  order_prefix: "SI/ORD", order_next_number: 1, order_pad: 2,
  po_prefix: "SI/PO", po_next_number: 1, po_pad: 2,
  rfq_prefix: "SI/RFQ", rfq_next_number: 1, rfq_pad: 2,
  quote_prefix: "SI/QT", quote_next_number: 1, quote_pad: 2, quote_validity_days: 30,
  credit_note_prefix: "SI/CN", credit_note_next_number: 1, credit_note_pad: 2,
  receipt_prefix: "SI/RCPT", receipt_next_number: 1, receipt_pad: 2, invoice_copies: ["original"],
};
beforeEach(() => {
  vi.resetAllMocks();
  const query = { eq: mocks.eq, is: mocks.eq, select: () => query, maybeSingle: mocks.single };
  mocks.update.mockReturnValue(query); mocks.eq.mockReturnValue(query);
  mocks.single.mockResolvedValue({ data: { id: true }, error: null });
  mocks.current.mockResolvedValue({ ...valid, credit_note_next_number: 2, credit_note_fy: financialYear() });
});
describe("credit note Sales Settings", () => {
  it("saves the stock restoration preference independently from invoice deduction", async () => {
    expect((await updateSalesSettings({ ...valid, credit_note_restores_stock: false }, 1)).success).toBe(true);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ credit_note_restores_stock: false, invoice_reduces_stock: true });
  });
  it("keeps a counter advanced by issuance when the admin did not edit it", async () => {
    expect((await updateSalesSettings(valid, 1)).success).toBe(true);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("credit_note_next_number");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("credit_note_fy");
  });
  it("rejects a deliberate counter change from a stale screen", async () => {
    expect((await updateSalesSettings({ ...valid, credit_note_next_number: 10 }, 1)).success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("stamps the current FY on an edited counter and detects a race during the update", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    expect((await updateSalesSettings({ ...valid, credit_note_next_number: 10 }, 2)).success).toBe(false);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ credit_note_next_number: 10, credit_note_fy: financialYear() });
    expect(mocks.eq).toHaveBeenCalledWith("credit_note_next_number", 2);
  });
  it("validates full generated-number length as well as the prefix characters", () => {
    expect(salesSettingsSchema.safeParse(valid).success).toBe(true);
    expect(salesSettingsSchema.safeParse({ ...valid, credit_note_prefix: "SI_CN" }).success).toBe(false);
    expect(salesSettingsSchema.safeParse({ ...valid, credit_note_prefix: "LONG/CN", credit_note_pad: 3 }).success).toBe(false);
  });
});
