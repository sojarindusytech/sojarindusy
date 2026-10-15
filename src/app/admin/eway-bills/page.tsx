import { redirect } from "next/navigation";
import { EWAY_BILL_PORTAL_URL } from "@/lib/invoice";

// E-Way Bills are generated on the government portal; send anyone who lands here (old link, bookmark) there.
export default function EwayBillsAdminPage() {
  redirect(EWAY_BILL_PORTAL_URL);
}
