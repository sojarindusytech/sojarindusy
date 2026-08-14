import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Tags } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Material Grades & HRC Series | Categories | Sojar Indusy Admin",
  description: "Manage hardness grades (HRC 45, HRC 55, HRC 65) and carbide substrate series.",
};

export default function MaterialGradesAdminPage() {
  return (
    <AdminComingSoon
      section="Categories > Material Grades"
      title="Material Grades & HRC Series"
      description="Manage tungsten carbide grain sizes, cobalt binder percentages, and hardness ratings (SIH45, SIH55, SIH65, Ultra Micro Grain)."
      icon={Tags}
      features={[
        "Substrate hardness (HRA/HRC) and transverse rupture strength (TRS) specifications",
        "Workpiece material suitability (Hardened Steels, Titanium, Inconel, Cast Iron)",
        "Raw carbide rod cost correlation and dynamic baseline pricing",
        "Batch lot tracking and quality cert compliance records",
      ]}
    />
  );
}
