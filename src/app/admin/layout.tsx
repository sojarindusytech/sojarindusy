import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getCurrentUserProfile } from "@/actions/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "Admin User";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <AdminHeader userName={fullName} userEmail={user.email} />
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
