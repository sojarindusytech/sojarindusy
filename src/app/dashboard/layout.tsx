import { getCurrentUserProfile } from "@/actions/auth";
import { redirect } from "next/navigation";
import { CustomerLayoutClient } from "@/components/customer/CustomerLayoutClient";
import { accountHome } from "@/lib/account-home";

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

  // Admins and manufacturers go to their portals; pending and rejected accounts to their holding screens.
  const home = accountHome(profile?.role, profile?.approval_status);
  if (home !== "/dashboard") redirect(home);

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
