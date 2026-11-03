import { getCurrentUserProfile } from "@/actions/auth";
import { PendingApprovalClient } from "@/components/customer/PendingApprovalClient";
import { accountHome } from "@/lib/account-home";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Verification Pending | Sojar Solutions",
  description: "Your enterprise account is currently awaiting verification and approval.",
};

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  // Only a pending account belongs here; admins, manufacturers, approved and rejected accounts go home.
  const home = accountHome(profile?.role, profile?.approval_status);
  if (home !== "/pending-approval") redirect(home);

  return <PendingApprovalClient user={user} profile={profile} />;
}
