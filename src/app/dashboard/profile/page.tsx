import { getCurrentUserProfile } from "@/actions/auth";
import { CustomerProfileView } from "@/components/customer/CustomerProfileView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery Sites & Enterprise Profile | Sojar Indusy",
  description: "Manage registered enterprise details, GSTIN, and delivery locations.",
};

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage() {
  const { profile } = await getCurrentUserProfile();

  return <CustomerProfileView initialProfile={profile} />;
}
