import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPROVAL_STATUSES, UserRole } from "@/lib/constants";

/**
 * Authorization guards for Server Actions.
 *
 * Every action in `src/actions/*` runs with the Service Role client, which
 * bypasses Row Level Security entirely. Server Actions are publicly reachable
 * HTTP endpoints, so each privileged action MUST establish the caller's
 * identity and role itself before touching the admin client.
 *
 * These guards throw on failure. A thrown error aborts the action and returns
 * an opaque error to the client without leaking why authorization failed.
 */

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  approvalStatus: string;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "platform_owner";
}

/**
 * Resolves the caller from the session cookie and loads their authoritative
 * role from the `profiles` table.
 *
 * `auth.getUser()` is used rather than `getSession()` because it revalidates
 * the JWT against the Auth server; a session read alone trusts an unverified
 * cookie payload. The role is read from the database rather than from
 * `user_metadata`, because metadata is writable by the account holder via the
 * Supabase client and therefore cannot be trusted for authorization.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .single();

  const profile = data as { role?: UserRole; approval_status?: string } | null;

  // Deny by default: a missing profile row is never treated as an approved
  // account, and never inherits a role from client-writable user_metadata.
  return {
    userId: user.id,
    email: user.email || "",
    role: profile?.role ?? "customer",
    approvalStatus: profile?.approval_status ?? APPROVAL_STATUSES.PENDING,
  };
}

/** Any authenticated user. Throws if signed out. */
export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthorizationError("Authentication required.");
  return ctx;
}

/** An authenticated customer whose account has been approved by an admin. */
export async function requireApprovedCustomer(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (isAdminRole(ctx.role)) return ctx;
  if (ctx.approvalStatus !== APPROVAL_STATUSES.APPROVED) {
    throw new AuthorizationError("Account pending approval.");
  }
  return ctx;
}

/** An administrator. Guards every action that uses the Service Role client. */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!isAdminRole(ctx.role)) throw new AuthorizationError("Administrator access required.");
  return ctx;
}

/**
 * Wraps a guard for actions that return `{ error }` to the UI instead of
 * throwing, so an expired session renders a message rather than an error page.
 */
export async function guardOrError<T extends AuthContext>(
  guard: () => Promise<T>
): Promise<{ ctx: T; error?: undefined } | { ctx?: undefined; error: string }> {
  try {
    return { ctx: await guard() };
  } catch (err) {
    return {
      error: err instanceof AuthorizationError ? err.message : "Unauthorized",
    };
  }
}
