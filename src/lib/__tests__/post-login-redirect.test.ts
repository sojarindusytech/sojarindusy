/**
 * Self-check for post-login redirect resolution.
 *   npx tsx src/lib/__tests__/post-login-redirect.test.ts
 */
import assert from "node:assert/strict";
import { resolvePostLoginRedirect, isSafeInternalPath } from "../post-login-redirect";

// --- The reported bug: stale ?redirect=/manufacturer must not capture an admin ---
assert.equal(
  resolvePostLoginRedirect("/manufacturer", "admin"),
  null,
  "admin must NOT be sent to the manufacturer portal by a leftover param"
);
assert.equal(resolvePostLoginRedirect("/manufacturer", "manufacturer"), "/manufacturer");
assert.equal(resolvePostLoginRedirect("/manufacturer", "customer"), null);

// --- Each role keeps its own area ---
assert.equal(resolvePostLoginRedirect("/admin/products", "admin"), "/admin/products");
assert.equal(resolvePostLoginRedirect("/admin/products", "platform_owner"), "/admin/products");
assert.equal(resolvePostLoginRedirect("/admin/products", "manufacturer"), null);
assert.equal(resolvePostLoginRedirect("/admin/products", "customer"), null);
assert.equal(resolvePostLoginRedirect("/dashboard/orders", "customer"), "/dashboard/orders");
assert.equal(resolvePostLoginRedirect("/dashboard/orders", "admin"), null);

// --- Prefix matching must be on a path boundary, not a substring ---
assert.equal(
  resolvePostLoginRedirect("/administrators-are-cool", "customer"),
  "/administrators-are-cool",
  "/admin must not match /administrators..."
);

// --- Public paths are open to everyone, including signed-out-ish roles ---
assert.equal(resolvePostLoginRedirect("/products/end-mill", "customer"), "/products/end-mill");
assert.equal(resolvePostLoginRedirect("/products/end-mill", "admin"), "/products/end-mill");
assert.equal(resolvePostLoginRedirect("/checkout", "customer"), "/checkout");

// --- Open-redirect vectors are refused ---
for (const evil of [
  "https://evil.com",
  "//evil.com",
  "/" + String.fromCharCode(92) + "evil.com", // the /\ protocol-relative variant
  "http://evil.com/path",
  "javascript:alert(1)",
  "evil.com",
]) {
  assert.equal(isSafeInternalPath(evil), false, `${evil} must be rejected as unsafe`);
  assert.equal(resolvePostLoginRedirect(evil, "admin"), null, `${evil} must not be redirected to`);
}

// --- A query string cannot smuggle an allowed prefix past the area check ---
assert.equal(
  resolvePostLoginRedirect("/manufacturer?next=/admin", "admin"),
  null,
  "area check reads the path, not the query"
);
assert.equal(
  resolvePostLoginRedirect("/dashboard/orders?tab=open", "customer"),
  "/dashboard/orders?tab=open",
  "a legitimate query string is preserved"
);

// --- Missing input falls through to the caller's default ---
assert.equal(resolvePostLoginRedirect(null, "admin"), null);
assert.equal(resolvePostLoginRedirect("", "admin"), null);
assert.equal(resolvePostLoginRedirect("/admin", undefined), null, "unknown role gets no area access");

console.log("post-login-redirect: all assertions passed");
