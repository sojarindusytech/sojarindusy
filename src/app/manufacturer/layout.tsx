import { getCurrentUserProfile } from "@/actions/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManufacturerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?redirect=/manufacturer");
  }

  const role = profile?.role;
  // Allow manufacturer, admin, or platform_owner
  if (role !== "manufacturer" && role !== "admin" && role !== "platform_owner") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
