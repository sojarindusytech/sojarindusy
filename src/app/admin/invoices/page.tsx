import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax Invoices | Sojar Indusy Admin",
  description: "GST Tax Invoices and billing registry.",
};

export default function InvoicesAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Invoice"
      description="Generate, print, and track GST-compliant commercial tax invoices with QR codes and digital signatures."
      icon={FileSpreadsheet}
      features={[
        "Automatic HSN code lookup and split CGST / SGST / IGST tax calculation",
        "PDF generation with company logo, bank details, and terms",
        "Payment reconciliation with automated overdue reminders",
        "GSTR-1 compatible monthly export reports",
      ]}
    />
  );
}
