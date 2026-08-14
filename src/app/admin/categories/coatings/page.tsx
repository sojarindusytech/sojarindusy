import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Tags } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coatings & Surface Treatments | Categories | Sojar Indusy Admin",
  description: "Manage PVD/CVD coating treatments (AlTiN, TiSiN, DLC, Nano Blue, Uncoated).",
};

export default function CoatingsAdminPage() {
  return (
    <AdminComingSoon
      section="Categories > Coatings"
      title="Coatings & Treatments"
      description="Configure physical vapor deposition (PVD) coatings, maximum working temperatures, and friction coefficient ratings."
      icon={Tags}
      features={[
        "Coating color and visual identifier mappings (Dark Bronze, Blue-Violet, Rainbow DLC, Charcoal)",
        "Thermal resistance ratings (up to 1100°C for dry/high-speed machining)",
        "Coating thickness specifications (1-4 microns) and micro-hardness (HV)",
        "Coating vendor job-work batch tracking and cost markups",
      ]}
    />
  );
}
