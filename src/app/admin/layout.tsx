import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { getCurrentUserProfile } from "@/actions/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  // Authentication alone is not authorization: without this check any signed-in
  // customer could open the admin console by navigating to /admin.
  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "Admin User";

  return (
    <AdminLayoutClient userName={fullName} userEmail={user.email}>
      {children}
    </AdminLayoutClient>
  );
}
