import { getCurrentUserProfile } from "@/actions/auth";
import { PendingApprovalClient } from "@/components/customer/PendingApprovalClient";
import { APPROVAL_STATUSES } from "@/lib/constants";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Verification Pending | Sojar Indusy",
  description: "Your enterprise account is currently awaiting verification and approval.",
};

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  // If user is Admin, route to Admin Dashboard
  const userRole = profile?.role;
  if (userRole === "admin" || userRole === "platform_owner") {
    redirect("/admin/dashboard");
  }

  // If already approved, route directly to Customer Dashboard
  if (profile?.approval_status === APPROVAL_STATUSES.APPROVED) {
    redirect("/dashboard");
  }

  return <PendingApprovalClient user={user} profile={profile} />;
}
