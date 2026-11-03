import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUserProfile } from "@/actions/auth";
import { accountHome } from "@/lib/account-home";
import { loadSalesSettings } from "@/lib/sales-settings";
import { ApplicationRejectedClient } from "@/components/customer/ApplicationRejectedClient";

export const metadata: Metadata = {
  title: "Application Not Approved | Sojar Solutions",
  description: "Your enterprise account application was not approved.",
};

export const dynamic = "force-dynamic";

export default async function ApplicationRejectedPage() {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");

  // Only a rejected account belongs here; everyone else goes to their own home.
  const home = accountHome(profile?.role, profile?.approval_status);
  if (home !== "/application-rejected") redirect(home);

  const settings = await loadSalesSettings();
  return (
    <ApplicationRejectedClient
      user={user}
      profile={profile}
      supportEmail={settings?.email || "support@sojarsolutions.com"}
      supportPhone={settings?.phone || null}
    />
  );
}
