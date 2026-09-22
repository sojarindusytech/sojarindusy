import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
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
    <div className="flex min-h-screen bg-white">
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-1 min-w-0 flex-col bg-white">
        <AdminHeader userName={fullName} userEmail={user.email} />
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
