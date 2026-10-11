/**
 * The live project has access policies that were created by hand in the
 * Supabase dashboard and exist in no migration (found by the 20261015
 * preflight check). This suite recreates them exactly, shows the holes they
 * open, then applies 20261015_01 / _05 and checks the holes are closed while
 * the access the app needs still works.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, readMigration, type TestDb } from "./test-db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  custA: "00000000-0000-4000-8000-00000000000a",
  custB: "00000000-0000-4000-8000-00000000000b",
};

// Copied from the preflight output of the live project (2026-10-10).
const LIVE_HAND_MADE = `
  CREATE FUNCTION public.is_platform_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public AS $$ SELECT public.is_admin() $$;

  -- public.rfqs itself (also hand-made) is in supabase-baseline.sql.
  ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.rfqs TO anon, authenticated, service_role;
  CREATE POLICY "Service role full access on rfqs" ON public.rfqs FOR ALL TO public USING (true) WITH CHECK (true);
  CREATE POLICY "Users can insert own rfqs" ON public.rfqs FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update own pending rfqs" ON public.rfqs FOR UPDATE TO public USING (auth.uid() = user_id);
  CREATE POLICY "Users can view own rfqs" ON public.rfqs FOR SELECT TO public USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
  CREATE POLICY "Users can read own profile or admin can read all" ON public.profiles FOR SELECT TO public
    USING ((auth.uid() = id) OR is_platform_owner());
  CREATE POLICY "Users can update own profile or admin can update any" ON public.profiles FOR UPDATE TO public
    USING ((auth.uid() = id) OR is_platform_owner());

  ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Admin can update orders" ON public.orders FOR UPDATE TO public USING (is_platform_owner());
  CREATE POLICY "Users can view own orders or admin view all" ON public.orders FOR SELECT TO public
    USING ((auth.uid() = user_id) OR is_platform_owner());
  CREATE POLICY "Users or admin can insert orders" ON public.orders FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id) OR is_platform_owner());

  CREATE POLICY "product-documents admin delete" ON storage.objects FOR DELETE TO public
    USING (bucket_id = 'product-documents');
  CREATE POLICY "product-documents admin upload" ON storage.objects FOR INSERT TO public
    WITH CHECK (bucket_id = 'product-documents');
  CREATE POLICY "product-documents public read" ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'product-documents');
`;

let t: TestDb;

const escalate = (user: string) =>
  t.as("authenticated", user, (tx) =>
    tx.query(`UPDATE public.profiles SET role = 'admin', approval_status = 'approved' WHERE id = $1 RETURNING id`, [user])
  );
const anonRfqs = () => t.as("anon", null, (tx) => tx.query(`SELECT * FROM public.rfqs`));
const anonUpload = () =>
  t.as("anon", null, (tx) => tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-documents', 'x.pdf')`));
const customerInsertsOrder = () =>
  t.as("authenticated", ids.custA, (tx) =>
    tx.query(`INSERT INTO public.orders (user_id, order_number, total_amount, shipping_address)
              VALUES ($1, 'FAKE-${Math.random()}', 1, 'x') RETURNING id`, [ids.custA]));

beforeAll(async () => {
  t = await createTestDb({ applyNew: false });
  for (const [key, role] of [["admin", "admin"], ["custA", "customer"], ["custB", "customer"]] as const) {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [ids[key], `${key}@test.in`]);
    await t.db.query(
      `INSERT INTO public.profiles (id, email, role, approval_status) VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (id) DO UPDATE SET role = $3, approval_status = 'pending'`,
      [ids[key], `${key}@test.in`, role]
    );
  }
  await t.db.query(`UPDATE public.profiles SET approval_status = 'approved' WHERE id = $1`, [ids.admin]);
  await t.db.exec(LIVE_HAND_MADE);
  await t.db.exec(`
    INSERT INTO public.rfqs (rfq_number, user_id, item_name, quantity, email) VALUES
      ('RFQ-A', '${ids.custA}', 'End mill', '10', 'a@example.com'),
      ('RFQ-B', '${ids.custB}', 'Drill', '5', 'b@example.com');
  `);
});

describe("live project before the fix", () => {
  it("lets a pending customer make themselves an approved admin", async () => {
    expect((await escalate(ids.custA)).rows).toHaveLength(1);
    await t.db.query(`UPDATE public.profiles SET role = 'customer', approval_status = 'pending' WHERE id = $1`, [ids.custA]);
  });

  it("lets anyone read every RFQ", async () => {
    expect((await anonRfqs()).rows).toHaveLength(2);
  });

  it("lets anyone upload to product-documents", async () => {
    await anonUpload();
  });

  it("lets a customer write an order directly", async () => {
    expect((await customerInsertsOrder()).rows).toHaveLength(1);
  });
});

describe("after 20261015_01_security_hardening", () => {
  beforeAll(async () => {
    await t.db.exec(readMigration("20261015_01_security_hardening.sql"));
  });

  it("blocks changing your own role or approval", async () => {
    await expect(escalate(ids.custB)).rejects.toThrow(/row-level security/);
    const [row] = (await t.db.query<{ role: string }>(`SELECT role FROM public.profiles WHERE id = $1`, [ids.custB])).rows;
    expect(row.role).toBe("customer");
  });

  it("still lets customers read and edit their own non-privileged details", async () => {
    const read = await t.as("authenticated", ids.custB, (tx) => tx.query(`SELECT id FROM public.profiles`));
    expect(read.rows).toHaveLength(1);
    const edit = await t.as("authenticated", ids.custB, (tx) =>
      tx.query(`UPDATE public.profiles SET mobile = '9999999999' WHERE id = $1 RETURNING id`, [ids.custB]));
    expect(edit.rows).toHaveLength(1);
  });

  it("blocks inserting a profile directly", async () => {
    await t.db.query(`INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000cc', 'c@test.in')`);
    await t.db.query(`DELETE FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000cc'`);
    await expect(t.as("authenticated", "00000000-0000-4000-8000-0000000000cc", (tx) =>
      tx.query(`INSERT INTO public.profiles (id, email, role, approval_status)
                VALUES ('00000000-0000-4000-8000-0000000000cc', 'c@test.in', 'admin', 'approved')`)))
      .rejects.toThrow(/row-level security/);
  });

  it("limits RFQs to their owner and admins", async () => {
    expect((await anonRfqs()).rows).toHaveLength(0);
    const own = await t.as("authenticated", ids.custA, (tx) => tx.query(`SELECT rfq_number FROM public.rfqs`));
    expect(own.rows).toEqual([{ rfq_number: "RFQ-A" }]);
    const admin = await t.as("authenticated", ids.admin, (tx) => tx.query(`SELECT * FROM public.rfqs`));
    expect(admin.rows).toHaveLength(2);
    await expect(t.as("authenticated", ids.custA, (tx) =>
      tx.query(`UPDATE public.rfqs SET quoted_amount = 1 WHERE user_id = $1 RETURNING id`, [ids.custA])))
      .resolves.toMatchObject({ rows: [] });
  });

  it("blocks anonymous uploads to product-documents, allows admins", async () => {
    await expect(anonUpload()).rejects.toThrow(/row-level security/);
    await t.as("authenticated", ids.admin, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-documents', 'ok.pdf')`));
  });

  it("leaves order inserts open until 05 runs (today's live checkout still needs them)", async () => {
    expect((await customerInsertsOrder()).rows).toHaveLength(1);
  });
});

describe("after 20261015_05_lock_order_writes (post-deploy)", () => {
  beforeAll(async () => {
    await t.db.exec(readMigration("20261015_05_lock_order_writes.sql"));
  });

  it("blocks customer order writes but keeps reads", async () => {
    await expect(customerInsertsOrder()).rejects.toThrow(/permission denied/);
    const own = await t.as("authenticated", ids.custA, (tx) => tx.query(`SELECT user_id FROM public.orders`));
    expect(own.rows.every((r) => (r as { user_id: string }).user_id === ids.custA)).toBe(true);
    const admin = await t.as("authenticated", ids.admin, (tx) => tx.query(`SELECT id FROM public.orders`));
    expect(admin.rows.length).toBeGreaterThan(0);
  });
});
