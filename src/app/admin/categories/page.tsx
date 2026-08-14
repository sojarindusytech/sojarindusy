import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Tags } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories & Variants | Sojar Indusy Admin",
  description: "Category and variant matrix management.",
};

export default function CategoriesAdminPage() {
  return (
    <AdminComingSoon
      section="Product Management"
      title="Categories / Variants"
      description="Define tooling hierarchies, cutting geometry categories, and material grade specifications."
      icon={Tags}
      features={[
        "Hierarchical category and sub-category trees",
        "Custom tooling attribute schemas (Corner Radius, Helix Angle, Coatings)",
        "Automated SEO tagging and category filtering presets",
        "Cross-category variant grouping and compatibility tables",
      ]}
    />
  );
}
