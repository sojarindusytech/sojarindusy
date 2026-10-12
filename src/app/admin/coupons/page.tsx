import type { Metadata } from "next";
import { fetchCouponFormOptions, fetchCouponsList } from "@/actions/coupon";
import { CouponManagementClient } from "@/components/admin/coupons/CouponManagementClient";

export const metadata: Metadata = {
  title: "Coupons | Sojar Solutions Admin",
  description: "Create and manage discount coupons for checkout.",
};

export const dynamic = "force-dynamic";

export default async function CouponsAdminPage() {
  const [coupons, options] = await Promise.all([fetchCouponsList(), fetchCouponFormOptions()]);
  return <CouponManagementClient initialCoupons={coupons} options={options} />;
}
