import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Tags } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tool Types | Categories | Sojar Indusy Admin",
  description: "Manage CNC Tool Types (Flat End Mill, Ball Nose, Corner Radius, Chamfer Mill, etc.).",
};

export default function ToolTypesAdminPage() {
  return (
    <AdminComingSoon
      section="Categories > Tool Types"
      title="Tool Types"
      description="Configure cutting geometry classifications including Flat End Mills, Ball Nose, Corner Radius, Roughing, and Chamfer Mills."
      icon={Tags}
      features={[
        "Definition of tool geometry parameters (End geometry, shank type, neck relief)",
        "Automated SKU prefix mapping and standard dimensions generator",
        "Application compatibility matrix (Milling, Slotting, Plunging, Profiling)",
        "3D preview model association and technical diagram attachments",
      ]}
    />
  );
}
