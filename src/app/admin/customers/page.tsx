import { fetchCustomersList } from "@/actions/customer";
import { CustomerManagementClient } from "@/components/admin/CustomerManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Directory & Approvals | Sojar Indusy Admin",
  description: "Manage registered platform users, offline billing accounts, and account onboarding approvals.",
};

export const dynamic = "force-dynamic";

export default async function CustomersAdminPage() {
  const customers = await fetchCustomersList();

  return <CustomerManagementClient initialCustomers={customers} />;
}
