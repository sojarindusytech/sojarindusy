import { fetchTags } from "@/actions/tag";
import { TagManagementClient } from "@/components/admin/TagManagementClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tags Management | Sojar Indusy Admin",
  description: "Manage product tags, hardness ratings (HRC 55, HRC 45, HRC 65), and coatings.",
};

export const revalidate = 0;

export default async function TagsPage() {
  const tags = await fetchTags();
  return <TagManagementClient initialTags={tags} />;
}
