/**
 * Code-level tests of the authentication module: sign up, sign in, forgot / reset password, resend,
 * the email-link callback, admin approve / reject, and the guards that enforce the result.
 *
 * The real server actions run against an in-memory fake of Supabase (tests/stubs/fake-supabase.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeWorld } from "../stubs/fake-supabase";

const holder = vi.hoisted(() => ({ world: null as unknown as FakeWorld }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => holder.world.userClient() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => holder.world.adminClient() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n.toLowerCase() === "x-forwarded-for" ? holder.world.ip : null) }),
  cookies: async () => ({
    get: (n: string) => (holder.world.cookies.has(n) ? { name: n, value: holder.world.cookies.get(n)! } : undefined),
    set: (n: string, v: string) => void holder.world.cookies.set(n, v),
    delete: (n: string) => void holder.world.cookies.delete(n),
    getAll: () => [],
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/server/notifications", () => ({
  createNotification: async (n: Record<string, unknown>) => {
    holder.world.notifications.push(n);
    return { success: true };
  },
}));

import {
  signUpUser,
  signInUser,
  sendPasswordResetEmail,
  updateUserPassword,
  resendVerificationEmail,
  signOutUser,
  getCurrentUserProfile,
} from "@/actions/auth";
import { updateCustomerApprovalStatus } from "@/actions/customer";
import { requireAdmin, requireApprovedCustomer, requireUser, requireAdminOrManufacturer, getAuthContext } from "@/lib/auth-guard";
import { GET as authCallback } from "@/app/auth/callback/route";
import { RECOVERY_COOKIE } from "@/lib/server/recovery-cookie";

let world: FakeWorld;
let n = 0;
/** Every test gets its own IP and addresses, because the rate limiter keeps counters between tests. */
const fresh = (label: string) => `${label}${++n}@test.in`;

beforeEach(() => {
  world = new FakeWorld();
  holder.world = world;
  world.ip = `10.1.${Math.floor(n / 250)}.${n % 250}`;
  n += 1;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function signupForm(over: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    title: "Mr", first_name: "Asha", last_name: "Patel", department: "Purchase", designation: "Manager",
    mobile: "9820701219", email: fresh("buyer"), password: "Str0ng!pass", confirm_password: "Str0ng!pass",
    company_name: "Acme Tools", company_address: "Plot 7, Vapi", city: "Vapi", state: "Gujarat", pincode: "396191",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) fd.append(k, v);
  return fd;
}

// ---------------------------------------------------------------------------------------------------
describe("sign up", () => {
  it("creates an unconfirmed login and a PENDING customer profile, and tells admin and customer", async () => {
    const fd = signupForm();
    const email = fd.get("email") as string;
    const res = await signUpUser(fd);

    expect(res).toMatchObject({ success: true, needsEmailVerification: true, email });
    const user = world.users.get(email)!;
    expect(user.confirmed).toBe(false);
    const profile = world.profiles.get(user.id)!;
    expect(profile).toMatchObject({ role: "customer", approval_status: "pending", company_name: "Acme Tools", channel: "online" });
    expect(world.notifications.map((x) => x.role ?? "customer")).toEqual(["admin", "customer"]);
    expect(world.notifications[0]).toMatchObject({ link: "/admin/customers" });
  });

  it("ignores a role / approval posted in the form (no self-made admin)", async () => {
    const fd = signupForm({ role: "admin", approval_status: "approved" });
    await signUpUser(fd);
    const user = world.users.get(fd.get("email") as string)!;
    expect(world.profiles.get(user.id)).toMatchObject({ role: "customer", approval_status: "pending" });
    expect((world.calls.signUp[0] as { options: { data: Record<string, unknown> } }).options.data).toMatchObject({ role: "customer", approval_status: "pending" });
  });

  it("lower-cases and trims the email and upper-cases the GSTIN", async () => {
    const email = fresh("MiXed");
    const res = await signUpUser(signupForm({ email: `  ${email.toUpperCase()}  `, gstin: "27aaaaa0000a1z5" }));
    expect(res.success).toBe(true);
    const user = world.users.get(email.toLowerCase())!;
    expect(world.profiles.get(user.id)).toMatchObject({ email: email.toLowerCase(), gstin: "27AAAAA0000A1Z5" });
  });

  it("answers an already-registered address exactly like a new one and touches nothing", async () => {
    const existing = world.addUser({ email: fresh("taken"), approval: "approved" });
    const before = { ...world.profiles.get(existing.id)! };
    const fresh1 = await signUpUser(signupForm());
    const dup = await signUpUser(signupForm({ email: existing.email }));

    expect(dup.success).toBe(true);
    expect(dup.message).toBe(fresh1.message);
    expect(dup.needsEmailVerification).toBe(fresh1.needsEmailVerification);
    expect(world.profiles.get(existing.id)).toEqual(before);
    expect(world.calls.profileUpserts).toHaveLength(1); // only the genuinely new signup
    expect(world.notifications).toHaveLength(2); // no admin/customer notices for the duplicate
  });

  it("does not rewrite an approved or rejected profile when an unconfirmed login signs up again", async () => {
    for (const status of ["approved", "rejected"]) {
      const victim = world.addUser({ email: fresh(`unconfirmed-${status}`), confirmed: false, approval: status });
      const before = { ...world.profiles.get(victim.id)! };
      const res = await signUpUser(signupForm({ email: victim.email, company_name: "Attacker Ltd" }));
      expect(res.success).toBe(true);
      expect(world.profiles.get(victim.id)).toEqual(before);
    }
  });

  it("lets an unconfirmed PENDING signup be corrected by signing up again", async () => {
    const email = fresh("typo");
    await signUpUser(signupForm({ email, company_name: "Acme Tolls" }));
    await signUpUser(signupForm({ email, company_name: "Acme Tools" }));
    const user = world.users.get(email)!;
    expect(world.profiles.get(user.id)).toMatchObject({ company_name: "Acme Tools", approval_status: "pending" });
  });

  it.each([
    ["weak password", { password: "password", confirm_password: "password" }, "password"],
    ["password mismatch", { confirm_password: "Different1!" }, "confirm_password"],
    ["password over 72 bytes", { password: "Aa1!" + "x".repeat(70), confirm_password: "Aa1!" + "x".repeat(70) }, "password"],
    ["short mobile", { mobile: "98207" }, "mobile"],
    ["letters in mobile", { mobile: "98207abcde" }, "mobile"],
    ["bad email", { email: "not-an-email" }, "email"],
    ["unknown state", { state: "Narnia" }, "state"],
    ["bad pincode", { pincode: "012345" }, "pincode"],
    ["bad GSTIN", { gstin: "123" }, "gstin"],
    ["huge company name", { company_name: "x".repeat(151) }, "company_name"],
    ["missing first name", { first_name: "" }, "first_name"],
  ])("rejects %s before any account is created", async (_label, over, field) => {
    const res = await signUpUser(signupForm(over));
    expect(res.error).toBeTruthy();
    expect(res.field).toBe(field);
    expect(world.calls.signUp).toHaveLength(0);
    expect(world.users.size).toBe(0);
  });

  it("rolls the login back when the profile cannot be saved", async () => {
    world.failures.profileUpsert = "connection reset";
    const fd = signupForm();
    const res = await signUpUser(fd);
    expect(res.error).toMatch(/could not complete your registration/i);
    expect(res.error).not.toMatch(/connection reset/);
    expect(world.users.has(fd.get("email") as string)).toBe(false);
    expect(world.calls.deleteUser).toHaveLength(1);
  });

  it("never shows the provider's raw error", async () => {
    world.failures.signUp = "Database error saving new user: relation auth.secret does not exist";
    const res = await signUpUser(signupForm());
    expect(res.error).toBeTruthy();
    expect(res.error).not.toMatch(/relation|database/i);
  });

  it("is rate limited per caller", async () => {
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 7; i++) results.push((await signUpUser(signupForm())).error);
    expect(results.slice(0, 5).every((e) => !e)).toBe(true);
    expect(results[5]).toMatch(/too many attempts/i);
  });
});

// ---------------------------------------------------------------------------------------------------
describe("sign in", () => {
  it("approved customer goes to the dashboard", async () => {
    const u = world.addUser({ email: fresh("ok"), approval: "approved" });
    expect(await signInUser(u.email, u.password)).toEqual({ redirectUrl: "/dashboard", role: "customer" });
    expect(world.session).toBe(u.id);
  });

  it("pending customer goes to the holding page and gets no role", async () => {
    const u = world.addUser({ email: fresh("pend"), approval: "pending" });
    const res = await signInUser(u.email, u.password);
    expect(res).toEqual({ redirectUrl: "/pending-approval" });
    expect(res.role).toBeUndefined();
  });

  it("rejected customer is sent to the application-rejected screen and gets no role", async () => {
    const u = world.addUser({ email: fresh("rej"), approval: "rejected" });
    const res = await signInUser(u.email, u.password);
    expect(res).toEqual({ redirectUrl: "/application-rejected" });
    expect(res.role).toBeUndefined();
    // still signed in (so the screen can show who they are and offer Sign Out)...
    expect(world.session).toBe(u.id);
    // ...but every customer-only action is refused
    await expect(requireApprovedCustomer()).rejects.toThrow();
  });

  it.each([
    ["admin", "/admin/products"],
    ["platform_owner", "/admin/products"],
    ["manufacturer", "/manufacturer"],
  ])("%s lands on their own portal whatever the approval status says", async (role, url) => {
    const u = world.addUser({ email: fresh(role), role, approval: "pending" });
    expect(await signInUser(u.email, u.password)).toMatchObject({ redirectUrl: url, role });
  });

  it("wrong password and unknown email give the same message", async () => {
    const u = world.addUser({ email: fresh("known") });
    const wrong = await signInUser(u.email, "Wrong!pass1");
    const unknown = await signInUser(fresh("nobody"), "Wrong!pass1");
    expect(wrong).toEqual(unknown);
    expect(wrong.error).toMatch(/invalid email or password/i);
    expect(world.session).toBeNull();
  });

  it("unconfirmed email is flagged so the page can offer a resend", async () => {
    const u = world.addUser({ email: fresh("unconf"), confirmed: false });
    expect(await signInUser(u.email, u.password)).toMatchObject({ isEmailUnconfirmed: true, unconfirmedEmail: u.email });
  });

  it("an unconfirmed account with the WRONG password learns nothing", async () => {
    const u = world.addUser({ email: fresh("unconf2"), confirmed: false });
    const res = await signInUser(u.email, "Wrong!pass1");
    expect(res.isEmailUnconfirmed).toBeUndefined();
    expect(res.error).toMatch(/invalid email or password/i);
  });

  it("normalises the email (case, spaces)", async () => {
    const u = world.addUser({ email: fresh("case") });
    expect((await signInUser(`  ${u.email.toUpperCase()} `, u.password)).redirectUrl).toBe("/dashboard");
  });

  it.each([["", "x"], ["not-an-email", "x"], ["a@b.in", ""]])("validates input %j / %j without calling the provider", async (e, p) => {
    expect((await signInUser(e, p)).error).toBeTruthy();
    expect(world.session).toBeNull();
  });

  it("a user with no profile row is treated as PENDING, never approved", async () => {
    const u = world.addUser({ email: fresh("noprof"), profile: false });
    expect(await signInUser(u.email, u.password)).toEqual({ redirectUrl: "/pending-approval" });
  });

  it("ignores a role claimed in user_metadata", async () => {
    const u = world.addUser({ email: fresh("meta"), approval: "approved", metadata: { role: "admin", approval_status: "approved" } });
    expect(await signInUser(u.email, u.password)).toMatchObject({ role: "customer", redirectUrl: "/dashboard" });
  });

  it("blocks the 9th attempt from one IP, even with the right password", async () => {
    const u = world.addUser({ email: fresh("brute") });
    for (let i = 0; i < 8; i++) await signInUser(u.email, "Wrong!pass1");
    expect((await signInUser(u.email, u.password)).error).toMatch(/too many attempts/i);
    expect(world.session).toBeNull();
  });

  it("also limits one account attacked from many IPs", async () => {
    const u = world.addUser({ email: fresh("spray") });
    for (let i = 0; i < 8; i++) {
      world.ip = `172.16.${n}.${i}`;
      await signInUser(u.email, "Wrong!pass1");
    }
    world.ip = `172.16.${n}.99`;
    expect((await signInUser(u.email, u.password)).error).toMatch(/too many attempts/i);
  });
});

// ---------------------------------------------------------------------------------------------------
describe("forgot password", () => {
  it("sends the link and points it at the callback with next=/reset-password", async () => {
    const u = world.addUser({ email: fresh("fp") });
    const res = await sendPasswordResetEmail(u.email);
    expect(res.success).toBe(true);
    expect(JSON.stringify(world.calls.resetPasswordForEmail[0])).toContain("/auth/callback?next=/reset-password");
  });

  it("gives the same reply for unknown addresses and for provider failures", async () => {
    const known = await sendPasswordResetEmail(world.addUser({ email: fresh("fp2") }).email);
    const unknown = await sendPasswordResetEmail(fresh("ghost"));
    world.failures.resetPasswordForEmail = "SMTP quota exceeded for sender noreply@secret-host";
    const failing = await sendPasswordResetEmail(fresh("fp3"));
    expect(unknown).toEqual(known);
    expect(failing).toEqual(known);
    expect(JSON.stringify(failing)).not.toMatch(/SMTP|quota|secret/);
  });

  it("rejects a malformed address", async () => {
    expect((await sendPasswordResetEmail("nope")).error).toBeTruthy();
    expect(world.calls.resetPasswordForEmail).toHaveLength(0);
  });

  it("limits reset emails to 3 per address", async () => {
    const email = fresh("flood");
    const out = [];
    for (let i = 0; i < 5; i++) out.push((await sendPasswordResetEmail(email)).error);
    expect(out.slice(0, 3).every((e) => !e)).toBe(true);
    expect(out[3]).toMatch(/too many attempts/i);
    expect(world.calls.resetPasswordForEmail).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------------------------
describe("reset password", () => {
  const recoverySession = () => {
    const u = world.addUser({ email: fresh("reset") });
    world.signInAs(u);
    world.cookies.set(RECOVERY_COOKIE, "1");
    return u;
  };

  it("changes the password, spends the marker and ends every session", async () => {
    const u = recoverySession();
    const res = await updateUserPassword("N3w!password", "N3w!password");
    expect(res.success).toBe(true);
    expect(u.password).toBe("N3w!password");
    expect(world.cookies.has(RECOVERY_COOKIE)).toBe(false);
    expect(world.calls.signOut).toEqual([{ scope: "global" }]);
    expect(world.session).toBeNull();
  });

  it("is single use: the same link cannot set a second password", async () => {
    recoverySession();
    await updateUserPassword("N3w!password", "N3w!password");
    const again = await signInUser("x", "y"); // unrelated call to prove state moves on
    void again;
    const u2 = world.users.values().next().value!;
    world.signInAs(u2);
    const res = await updateUserPassword("An0ther!pass", "An0ther!pass");
    expect(res.error).toMatch(/invalid or has expired/i);
    expect(u2.password).toBe("N3w!password");
  });

  it("a normal signed-in session (no recovery link) cannot change the password", async () => {
    const u = world.addUser({ email: fresh("hijack") });
    world.signInAs(u);
    const res = await updateUserPassword("N3w!password", "N3w!password");
    expect(res.error).toMatch(/invalid or has expired/i);
    expect(u.password).toBe("Str0ng!pass");
    expect(world.calls.updateUser).toHaveLength(0);
  });

  it.each([
    ["too weak", "weak", "weak"],
    ["mismatch", "N3w!password", "N3w!passwordX"],
    ["over 72 bytes", "Aa1!" + "x".repeat(70), "Aa1!" + "x".repeat(70)],
  ])("rejects a %s password and keeps the link usable for a retry", async (_l, p, c) => {
    const u = recoverySession();
    expect((await updateUserPassword(p, c)).error).toBeTruthy();
    expect(u.password).toBe("Str0ng!pass");
    expect(world.cookies.has(RECOVERY_COOKIE)).toBe(true);
    expect((await updateUserPassword("N3w!password", "N3w!password")).success).toBe(true);
  });

  it("a provider failure shows a generic message and keeps the link usable", async () => {
    recoverySession();
    world.failures.updateUser = "New password should be different from the old password.";
    const res = await updateUserPassword("N3w!password", "N3w!password");
    expect(res.error).toBeTruthy();
    expect(res.error).not.toMatch(/different from the old/);
    expect(world.cookies.has(RECOVERY_COOKIE)).toBe(true);
    expect(world.calls.signOut).toHaveLength(0);
  });

  it("the old password stops working and the new one works", async () => {
    const u = recoverySession();
    await updateUserPassword("N3w!password", "N3w!password");
    expect((await signInUser(u.email, "Str0ng!pass")).error).toBeTruthy();
    expect((await signInUser(u.email, "N3w!password")).redirectUrl).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------------------------------------------
describe("resend verification", () => {
  it("answers the same for any address and never leaks the provider error", async () => {
    const ok = await resendVerificationEmail(fresh("r1"));
    world.failures.resend = "User already registered";
    const bad = await resendVerificationEmail(fresh("r2"));
    expect(bad).toEqual(ok);
    expect(JSON.stringify(bad)).not.toMatch(/already registered/);
  });

  it("rejects a malformed address and is rate limited", async () => {
    expect((await resendVerificationEmail("nope")).error).toBeTruthy();
    const email = fresh("r3");
    const out = [];
    for (let i = 0; i < 5; i++) out.push((await resendVerificationEmail(email)).error);
    expect(out[3]).toMatch(/too many attempts/i);
  });
});

// ---------------------------------------------------------------------------------------------------
describe("email link callback", () => {
  const call = (qs: string) => authCallback(new Request(`https://shop.test/auth/callback?${qs}`));
  const location = (r: Response) => r.headers.get("location");

  it("a valid recovery code signs in, redirects to /reset-password and sets the marker", async () => {
    const u = world.addUser({ email: fresh("cb") });
    world.codes.set("c1", u.id);
    const res = await call("code=c1&next=/reset-password");
    expect(location(res)).toBe("https://shop.test/reset-password");
    expect(res.headers.get("set-cookie")).toContain(`${RECOVERY_COOKIE}=1`);
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
    expect(world.session).toBe(u.id);
  });

  it("the same code cannot be used twice", async () => {
    const u = world.addUser({ email: fresh("cb2") });
    world.codes.set("c2", u.id);
    await call("code=c2&next=/reset-password");
    world.session = null;
    expect(location(await call("code=c2&next=/reset-password"))).toContain("/login?error=invalid-or-expired-link");
    expect(world.session).toBeNull();
  });

  it("only the reset page gets the marker (an approval or signup link does not)", async () => {
    const u = world.addUser({ email: fresh("cb3") });
    world.codes.set("c3", u.id);
    const res = await call("code=c3&next=/dashboard");
    expect(res.headers.get("set-cookie") ?? "").not.toContain(RECOVERY_COOKIE);
  });

  it("signup confirmation lands on /pending-approval?verified=true", async () => {
    const u = world.addUser({ email: fresh("cb4"), confirmed: false });
    world.codes.set("c4", u.id);
    expect(location(await call("code=c4&next=/pending-approval"))).toBe("https://shop.test/pending-approval?verified=true");
  });

  it("works with a token_hash and an allowed type", async () => {
    const u = world.addUser({ email: fresh("cb5") });
    world.codes.set("h1", u.id);
    expect(location(await call("token_hash=h1&type=recovery&next=/reset-password"))).toBe("https://shop.test/reset-password");
  });

  it("refuses a token_hash with a type that is not allowed", async () => {
    const u = world.addUser({ email: fresh("cb6") });
    world.codes.set("h2", u.id);
    expect(location(await call("token_hash=h2&type=phone_change&next=/dashboard"))).toContain("/login?error=");
    expect(world.session).toBeNull();
  });

  it.each(["https://evil.test", "//evil.test", "/admin/secret", "javascript:alert(1)"])("falls back to /dashboard for next=%s (no open redirect)", async (next) => {
    const u = world.addUser({ email: fresh("cb7") });
    world.codes.set("o1", u.id);
    expect(location(await call(`code=o1&next=${encodeURIComponent(next)}`))).toBe("https://shop.test/dashboard");
  });

  it("an expired or missing link goes to the login page with an error", async () => {
    expect(location(await call("code=nope&next=/reset-password"))).toContain("/login?error=invalid-or-expired-link");
    expect(location(await call("error=access_denied&error_description=expired"))).toContain("/login?error=invalid-or-expired-link");
    expect(location(await call(""))).toContain("/login?error=invalid-or-expired-link");
  });
});

// ---------------------------------------------------------------------------------------------------
describe("admin approves / rejects", () => {
  const asAdmin = () => world.signInAs(world.addUser({ email: fresh("admin"), role: "admin", approval: "approved" }));
  const pending = () => world.addUser({ email: fresh("cust"), approval: "pending" });

  it("approve: profile approved, login link emailed without creating a user, customer notified", async () => {
    asAdmin();
    const c = pending();
    const res = await updateCustomerApprovalStatus(c.id, "approved");
    expect(res.success).toBe(true);
    expect(world.profiles.get(c.id)).toMatchObject({ approval_status: "approved" });
    expect(world.calls.signInWithOtp).toHaveLength(1);
    expect(world.calls.signInWithOtp[0]).toMatchObject({ email: c.email, options: { shouldCreateUser: false } });
    expect(world.notifications).toEqual([expect.objectContaining({ userId: c.id, title: "Account Approved" })]);
  });

  it("reject: profile rejected, no email, customer notified", async () => {
    asAdmin();
    const c = pending();
    expect((await updateCustomerApprovalStatus(c.id, "rejected")).success).toBe(true);
    expect(world.profiles.get(c.id)).toMatchObject({ approval_status: "rejected" });
    expect(world.calls.signInWithOtp).toHaveLength(0);
    expect(world.notifications[0]).toMatchObject({ userId: c.id, title: "Account Application Status" });
  });

  it("a failed database write is reported as a failure and sends nothing", async () => {
    asAdmin();
    const c = pending();
    world.failures.profileUpdate = "deadlock";
    const res = await updateCustomerApprovalStatus(c.id, "approved");
    expect(res.success).toBe(false);
    expect(res.message).not.toMatch(/deadlock/);
    expect(world.calls.signInWithOtp).toHaveLength(0);
    expect(world.notifications).toHaveLength(0);
  });

  it("a failing approval email does not undo the approval", async () => {
    asAdmin();
    const c = pending();
    world.failures.signInWithOtp = "smtp down";
    const res = await updateCustomerApprovalStatus(c.id, "approved");
    expect(res.success).toBe(true);
    expect(world.profiles.get(c.id)).toMatchObject({ approval_status: "approved" });
  });

  it("refuses an invalid status", async () => {
    asAdmin();
    const c = pending();
    const res = await updateCustomerApprovalStatus(c.id, "superuser" as never);
    expect(res.success).toBe(false);
    expect(world.profiles.get(c.id)).toMatchObject({ approval_status: "pending" });
  });

  it.each(["customer", "manufacturer"])("a signed-in %s cannot approve anyone", async (role) => {
    world.signInAs(world.addUser({ email: fresh(role), role, approval: "approved" }));
    const c = pending();
    await expect(updateCustomerApprovalStatus(c.id, "approved")).rejects.toThrow();
    expect(world.profiles.get(c.id)).toMatchObject({ approval_status: "pending" });
  });

  it("a signed-out caller cannot approve anyone", async () => {
    const c = pending();
    await expect(updateCustomerApprovalStatus(c.id, "approved")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------
describe("full lifecycle and what the decision enforces", () => {
  it("signup -> pending login -> approve -> dashboard access -> reject locks the live session out", async () => {
    // 1. sign up
    const fd = signupForm();
    const email = fd.get("email") as string;
    await signUpUser(fd);
    const user = world.users.get(email)!;

    // 2. cannot log in until the email is confirmed
    expect(await signInUser(email, "Str0ng!pass")).toMatchObject({ isEmailUnconfirmed: true });
    user.confirmed = true;

    // 3. confirmed but unapproved: holding page, and every customer-only action is refused
    expect(await signInUser(email, "Str0ng!pass")).toEqual({ redirectUrl: "/pending-approval" });
    await expect(requireApprovedCustomer()).rejects.toThrow(/pending approval/i);

    // 4. admin approves
    const adminSession = world.session;
    world.signInAs(world.addUser({ email: fresh("boss"), role: "admin", approval: "approved" }));
    await updateCustomerApprovalStatus(user.id, "approved");

    // 5. customer now gets in
    expect(await signInUser(email, "Str0ng!pass")).toEqual({ redirectUrl: "/dashboard", role: "customer" });
    await expect(requireApprovedCustomer()).resolves.toMatchObject({ userId: user.id });

    // 6. admin later rejects: the customer's EXISTING session loses access immediately
    world.signInAs(world.users.get([...world.users.keys()].find((k) => k.startsWith("boss"))!)!);
    await updateCustomerApprovalStatus(user.id, "rejected");
    world.signInAs(user);
    await expect(requireApprovedCustomer()).rejects.toThrow();
    expect((await getCurrentUserProfile()).profile?.approval_status).toBe("rejected");
    // ...and a fresh login lands on the rejection screen
    world.session = null;
    expect((await signInUser(email, "Str0ng!pass")).redirectUrl).toBe("/application-rejected");
    void adminSession;
  });

  it("rejected, then approved again, regains access", async () => {
    world.signInAs(world.addUser({ email: fresh("boss2"), role: "admin", approval: "approved" }));
    const c = world.addUser({ email: fresh("again"), approval: "rejected" });
    await updateCustomerApprovalStatus(c.id, "approved");
    world.session = null;
    expect((await signInUser(c.email, c.password)).redirectUrl).toBe("/dashboard");
  });

  it("forgot -> link -> reset -> old session dead -> login with new password", async () => {
    const u = world.addUser({ email: fresh("full") });
    await sendPasswordResetEmail(u.email);
    world.codes.set("fl", u.id);
    await authCallback(new Request("https://shop.test/auth/callback?code=fl&next=/reset-password"));
    // the Response cookie is what a browser would send back
    world.cookies.set(RECOVERY_COOKIE, "1");
    expect((await updateUserPassword("Brand!new1", "Brand!new1")).success).toBe(true);
    expect(world.session).toBeNull();
    expect((await signInUser(u.email, "Brand!new1")).redirectUrl).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------------------------------------------
describe("guards and profile lookup", () => {
  it("requireUser / requireAdmin throw when signed out", async () => {
    await expect(requireUser()).rejects.toThrow();
    await expect(requireAdmin()).rejects.toThrow();
    expect(await getAuthContext()).toBeNull();
  });

  it("requireAdmin accepts admin and platform_owner only", async () => {
    for (const role of ["admin", "platform_owner"]) {
      world.signInAs(world.addUser({ email: fresh(role), role }));
      await expect(requireAdmin()).resolves.toMatchObject({ role });
    }
    for (const role of ["customer", "manufacturer"]) {
      world.signInAs(world.addUser({ email: fresh(role), role }));
      await expect(requireAdmin()).rejects.toThrow();
    }
  });

  it("requireAdminOrManufacturer accepts a manufacturer, refuses a customer", async () => {
    world.signInAs(world.addUser({ email: fresh("m"), role: "manufacturer" }));
    await expect(requireAdminOrManufacturer()).resolves.toBeTruthy();
    world.signInAs(world.addUser({ email: fresh("c"), role: "customer" }));
    await expect(requireAdminOrManufacturer()).rejects.toThrow();
  });

  it("a login with no profile row is a pending customer, whatever its metadata claims", async () => {
    world.signInAs(world.addUser({ email: fresh("meta"), profile: false, metadata: { role: "admin", approval_status: "approved" } }));
    expect(await getAuthContext()).toMatchObject({ role: "customer", approvalStatus: "pending" });
    await expect(requireAdmin()).rejects.toThrow();
    await expect(requireApprovedCustomer()).rejects.toThrow();
    const { profile } = await getCurrentUserProfile();
    expect(profile).toMatchObject({ role: "customer", approval_status: "pending" });
  });

  it("getCurrentUserProfile is empty when signed out", async () => {
    expect(await getCurrentUserProfile()).toEqual({ user: null, profile: null });
  });

  it("signOutUser ends the session and sends the user to /login", async () => {
    world.signInAs(world.addUser({ email: fresh("bye") }));
    await expect(signOutUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(world.session).toBeNull();
  });
});
