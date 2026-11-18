import type { Metadata } from "next";
import { getSalesReport } from "@/actions/reports";
import { ReportsClient } from "@/components/admin/ReportsClient";

export const metadata: Metadata = {
  title: "Reports | Sojar Solutions Admin",
  description: "Sales, GST, customers, products, collections, receivables and stock for any period.",
};

export const dynamic = "force-dynamic";

export default async function ReportsAdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  return <ReportsClient report={await getSalesReport({ from, to })} />;
}
