import { getCurrentUserProfile } from "@/actions/auth";
import { redirect } from "next/navigation";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
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

  // Enforce customer account approval status
  if (profile?.approval_status !== APPROVAL_STATUSES.APPROVED) {
    redirect("/pending-approval");
  }

  const fullName = profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}` : "Valued Client";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar Navigation */}
      <CustomerSidebar companyName={profile?.company_name || "Enterprise Account"} />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-x-hidden bg-white">
        {/* Top App Header */}
        <CustomerHeader
          userName={fullName}
          userEmail={user.email}
          companyName={profile?.company_name || "Enterprise Partner"}
        />

        {/* Main Content Area */}
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
