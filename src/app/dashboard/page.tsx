import { getCurrentUserProfile } from "@/actions/auth";
import { fetchCustomerOrdersList } from "@/actions/order";
import { CustomerOverviewView } from "@/components/customer/CustomerOverviewView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise Dashboard & Overview | Sojar Indusy",
  description: "Overview of your commercial credit line, active consignments, and recent industrial procurement orders.",
};

export const dynamic = "force-dynamic";

export default async function CustomerDashboardOverviewPage() {
  const { user, profile } = await getCurrentUserProfile();
  const orders = await fetchCustomerOrdersList();

  if (!user) return null;

  return (
    <CustomerOverviewView
      user={user}
      profile={profile}
      orders={orders}
    />
  );
}
