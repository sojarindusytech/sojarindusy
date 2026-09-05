import { CustomerSupportView } from "@/components/customer/CustomerSupportView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical Support & Logistics Helpdesk | Sojar Indusy",
  description: "Direct tooling engineering hotline and logistics assistance.",
};

export const dynamic = "force-dynamic";

export default function CustomerSupportPage() {
  return <CustomerSupportView />;
}
