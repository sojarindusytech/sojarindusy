import { getCurrentUserProfile } from "@/actions/auth";
import { redirect } from "next/navigation";
import { CustomerLayoutClient } from "@/components/customer/CustomerLayoutClient";
import { APPROVAL_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  // If user is Admin, route directly to Admin Dashboard
  const userRole = profile?.role;
  if (userRole === "admin" || userRole === "platform_owner") {
    redirect("/admin/dashboard");
  }

  // If user is Manufacturer, route to Manufacturer Dashboard
  if (userRole === "manufacturer") {
    redirect("/manufacturer");
  }

  // Enforce customer account approval status
  if (profile?.approval_status !== APPROVAL_STATUSES.APPROVED) {
    redirect("/pending-approval");
  }

  const fullName = profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}` : "Valued Client";

  return (
    <CustomerLayoutClient
      userName={fullName}
      userEmail={user.email}
      companyName={profile?.company_name || "Enterprise Partner"}
    >
      {children}
    </CustomerLayoutClient>
  );
}
