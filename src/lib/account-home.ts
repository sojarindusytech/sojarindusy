import type { UserRole } from "@/lib/constants";

/**
 * Where an account belongs once signed in. One rule shared by the dashboard layout, the holding
 * pages and sign-in, so a user is never left on the wrong screen.
 */
export function accountHome(role: UserRole | string | null | undefined, approvalStatus: string | null | undefined): string {
  if (role === "admin" || role === "platform_owner") return "/admin/dashboard";
  if (role === "manufacturer") return "/manufacturer";
  if (approvalStatus === "approved") return "/dashboard";
  if (approvalStatus === "rejected") return "/application-rejected";
  // pending, missing or anything unknown: deny by default
  return "/pending-approval";
}
