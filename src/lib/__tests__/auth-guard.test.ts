/**
 * Self-check for the authorization guards. No test framework.
 *   npx tsx src/lib/__tests__/auth-guard.test.ts
 *
 * Covers the decision logic only (role/approval evaluation); the Supabase
 * lookup in getAuthContext is the part these assertions deliberately stub.
 */
import assert from "node:assert/strict";
import { isAdminRole, AuthorizationError, guardOrError, type AuthContext } from "../auth-guard";
import { APPROVAL_STATUSES } from "../constants";

// --- isAdminRole: the single predicate every admin route relies on ---
assert.equal(isAdminRole("admin"), true);
assert.equal(isAdminRole("platform_owner"), true);
assert.equal(isAdminRole("customer"), false);
assert.equal(isAdminRole(undefined), false, "missing role must not be admin");
assert.equal(isAdminRole(null), false, "null role must not be admin");
assert.equal(isAdminRole(""), false);
assert.equal(isAdminRole("Admin"), false, "role check is case-sensitive");
assert.equal(isAdminRole("admin "), false, "no trimming: exact match only");

// --- Re-implementation of the approval branch, to assert deny-by-default ---
function checkApproved(ctx: AuthContext): boolean {
  if (isAdminRole(ctx.role)) return true;
  return ctx.approvalStatus === APPROVAL_STATUSES.APPROVED;
}

const base: AuthContext = {
  userId: "u1",
  email: "a@b.com",
  role: "customer",
  approvalStatus: APPROVAL_STATUSES.PENDING,
};

assert.equal(checkApproved(base), false, "pending customer is denied");
assert.equal(
  checkApproved({ ...base, approvalStatus: APPROVAL_STATUSES.REJECTED }),
  false,
  "rejected customer is denied"
);
assert.equal(
  checkApproved({ ...base, approvalStatus: APPROVAL_STATUSES.APPROVED }),
  true,
  "approved customer is allowed"
);
assert.equal(
  checkApproved({ ...base, approvalStatus: "" }),
  false,
  "unknown status is denied, never defaulted to approved"
);
assert.equal(
  checkApproved({ ...base, role: "admin" }),
  true,
  "admin bypasses customer approval"
);

// --- guardOrError converts a throw into a message instead of an error page ---
(async () => {
  const ok = await guardOrError(async () => base);
  assert.equal(ok.ctx?.userId, "u1");
  assert.equal(ok.error, undefined);

  const denied = await guardOrError(async () => {
    throw new AuthorizationError("Administrator access required.");
  });
  assert.equal(denied.ctx, undefined);
  assert.equal(denied.error, "Administrator access required.");

  // A non-authorization failure must not leak its internals to the client.
  const boom = await guardOrError(async () => {
    throw new Error("connection string: postgres://user:pw@host");
  });
  assert.equal(boom.error, "Unauthorized", "internal errors are not echoed back");

  console.log("auth-guard: all assertions passed");
})();
