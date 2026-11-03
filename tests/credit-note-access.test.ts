import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), auth: vi.fn(), db: vi.fn(), render: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ requireAdmin: mocks.admin, requireUser: mocks.auth, getAuthContext: mocks.auth, isAdminRole: (role: string) => ["admin", "platform_owner"].includes(role) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.db }));
vi.mock("@/lib/sales-settings", () => ({ loadSalesSettings: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: mocks.render }));
vi.mock("@/components/invoice/InvoicePdf", () => ({ InvoicePdf: () => null }));
import { issueCreditNote, listCreditNotes } from "@/actions/credit-note";
import { GET } from "@/app/api/credit-notes/[id]/pdf/route";
const id = "10000000-0000-4000-8000-000000000001";
const req = new Request(`http://localhost/api/credit-notes/${id}/pdf`);
beforeEach(() => { vi.resetAllMocks(); });
describe("credit note server authorization", () => {
  it("rejects an unauthorized issuance before accessing the privileged database", async () => {
    mocks.admin.mockRejectedValue(new Error("Administrator access required."));
    expect((await issueCreditNote({} as never)).success).toBe(false);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("customer listing filters using the session identity", async () => {
    mocks.auth.mockResolvedValue({ userId: "owner" });
    mocks.eq.mockResolvedValue({ data: [], error: null });
    mocks.db.mockReturnValue({ from: () => ({ select: () => ({ order: () => ({ eq: mocks.eq }) }) }) });
    await listCreditNotes(true);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("PDF rejects anonymous callers before querying notes", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(req, { params: Promise.resolve({ id }) })).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("PDF hides another customer's document even though the server uses service access", async () => {
    mocks.auth.mockResolvedValue({ userId: "other", role: "customer" });
    mocks.db.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id, user_id: "owner" }, error: null }) }) }) }) });
    expect((await GET(req, { params: Promise.resolve({ id }) })).status).toBe(404);
    expect(mocks.render).not.toHaveBeenCalled();
  });
});
