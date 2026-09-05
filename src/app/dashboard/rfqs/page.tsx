import { fetchCustomerRfqsList } from "@/actions/rfq";
import { CustomerRfqsView } from "@/components/customer/CustomerRfqsView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Tooling RFQs & Quotations | Sojar Indusy",
  description: "Submit technical drawings and request volume quotations for custom tooling.",
};

export const dynamic = "force-dynamic";

export default async function CustomerRfqsPage() {
  const rfqs = await fetchCustomerRfqsList();

  return <CustomerRfqsView initialRfqs={rfqs} />;
}
