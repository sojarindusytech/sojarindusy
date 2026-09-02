import { fetchAttributes } from "@/actions/attribute";
import { AttributeManagementClient } from "@/components/admin/AttributeManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attributes Management | Sojar Indusy Admin",
  description: "Manage product attributes, hardness ratings (HRC 55, HRC 45, HRC 65), and coatings.",
};

export default async function AttributesPage() {
  const attributes = await fetchAttributes();
  return <AttributeManagementClient initialAttributes={attributes} />;
}
