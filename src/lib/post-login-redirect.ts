/**
 * Resolves where to send a user after sign-in.
 *
 * The login page accepts a `?redirect=` parameter so a user bounced off a
 * protected page returns to it. That parameter is attacker-controllable and
 * can also be left over from a *different* user's session, so it is validated
 * against the signed-in user's role before it is honoured.
 */

import type { UserRole } from "@/lib/constants";

/** Path prefixes owned by a role. Anything else is public and open to all. */
const AREA_OWNERS: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin", "platform_owner"] },
  { prefix: "/manufacturer", roles: ["manufacturer"] },
  { prefix: "/dashboard", roles: ["customer"] },
];

/**
 * True only for a same-origin relative path. Rejects absolute URLs
 * ("https://evil.com"), protocol-relative ("//evil.com") and the backslash
 * variant browsers normalise to it ("/\evil.com").
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  if (path.includes("://")) return false;
  return true;
}

/**
 * Returns the `redirect` target when it is safe AND belongs to the user's own
 * area, otherwise null so the caller falls back to the role's default landing
 * page. Cross-area targets are refused even when the role could technically
 * view them -- an admin signing in should land on the admin portal, not on a
 * /manufacturer URL left behind by the previous session.
 */
export function resolvePostLoginRedirect(
  redirectTo: string | null | undefined,
  role: UserRole | undefined
): string | null {
  if (!isSafeInternalPath(redirectTo)) return null;

  // Compare on the path only; a query string must not smuggle in a prefix.
  const path = redirectTo.split(/[?#]/)[0];

  const owned = AREA_OWNERS.find(
    (a) => path === a.prefix || path.startsWith(`${a.prefix}/`)
  );

  // Public path: anyone may be returned to it.
  if (!owned) return redirectTo;

  return role && owned.roles.includes(role) ? redirectTo : null;
}
