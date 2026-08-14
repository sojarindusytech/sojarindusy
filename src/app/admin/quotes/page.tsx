import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { MessageSquareQuote } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Formal Quotations | Sojar Indusy Admin",
  description: "B2B Price Quotations and RFQ management.",
};

export default function QuotesAdminPage() {
  return (
    <AdminComingSoon
      section="Sales"
      title="Quotes"
      description="Prepare official price estimates, tender bids, and customized bulk discounting quotations."
      icon={MessageSquareQuote}
      features={[
        "Interactive quotation builder with SKU search and live margin calculation",
        "Configurable validity periods and payment term presets",
        "One-click client approval portal and conversion to Sales Order",
        "Quotation revision history and follow-up reminders",
      ]}
    />
  );
}
