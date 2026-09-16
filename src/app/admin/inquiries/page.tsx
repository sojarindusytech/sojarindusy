import { fetchContactSubmissions } from "@/actions/contact";
import { InquiriesManagementClient } from "@/components/admin/InquiriesManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Inquiries | Sojar Indusy Admin",
  description: "Review, respond, and manage inbound inquiries from your storefront contact form.",
};

export const dynamic = "force-dynamic";

export default async function InquiriesAdminPage() {
  const result = await fetchContactSubmissions();

  return (
    <InquiriesManagementClient
      initialSubmissions={result.data || []}
      tableMissing={result.tableMissing}
    />
  );
}
