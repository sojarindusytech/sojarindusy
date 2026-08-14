import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { Tags } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flute Configurations | Categories | Sojar Indusy Admin",
  description: "Manage 2 Flute, 3 Flute, 4 Flute, and Multi-Flute classifications.",
};

export default function FluteTypesAdminPage() {
  return (
    <AdminComingSoon
      section="Categories > Flute Configurations"
      title="Flute Types"
      description="Configure flute count variations (2 Flute, 3 Flute, 4 Flute, 6 Flute) and helix angle specifications (30°, 35°, 45°, Variable Helix)."
      icon={Tags}
      features={[
        "Chip evacuation efficiency rating and surface finish multipliers",
        "Material compatibility guidelines (Aluminum/Non-ferrous for 2-3F, Steels for 4-6F)",
        "Variable pitch and vibration dampening flute presets",
        "Automated speed and feed recommendation tables",
      ]}
    />
  );
}
