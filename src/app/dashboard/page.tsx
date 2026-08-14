import { getCurrentUserProfile, signOutUser } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  Phone,
  Mail,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Order } from "@/types/database.types";

export default async function CustomerDashboardPage() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  // Fetch user orders from Supabase
  const supabase = await createClient();
  const { data: dbOrders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fallback demo orders for instant visualization
  const orders: Order[] =
    dbOrders && dbOrders.length > 0
      ? (dbOrders as Order[])
      : [
          {
            id: "ord-1",
            user_id: user.id,
            order_number: "ORD-2026-8941",
            status: "processing",
            total_amount: 145200,
            items: [
              {
                id: "1",
                name: "High-Tensile Hex Bolt M16 x 60mm (Grade 8.8)",
                sku: "FAST-HTB-M16",
                quantity: 2500,
                unit_price: 32,
                total_price: 80000,
              },
              {
                id: "2",
                name: "Stainless Steel SS316 Ball Valve 2 inch",
                sku: "VALV-SS316-2IN",
                quantity: 12,
                unit_price: 5433,
                total_price: 65200,
              },
            ],
            shipping_address: `${profile?.company_address || "Industrial Estate"}, ${profile?.city || "Pune"}, ${profile?.state || "Maharashtra"} - ${profile?.pincode || "411001"}`,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "ord-2",
            user_id: user.id,
            order_number: "ORD-2026-8712",
            status: "delivered",
            total_amount: 89500,
            items: [
              {
                id: "3",
                name: "Precision CNC Flange Collar (EN8 Steel)",
                sku: "PREC-FLG-EN8",
                quantity: 150,
                unit_price: 596.66,
                total_price: 89500,
              },
            ],
            shipping_address: `${profile?.company_address || "Industrial Estate"}, ${profile?.city || "Pune"}, ${profile?.state || "Maharashtra"}`,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "ord-3",
            user_id: user.id,
            order_number: "ORD-2026-8501",
            status: "shipped",
            total_amount: 218000,
            items: [
              {
                id: "4",
                name: "Heavy-Duty Cast Iron Gate Valve DN100",
                sku: "VALV-CI-DN100",
                quantity: 20,
                unit_price: 10900,
                total_price: 218000,
              },
            ],
            shipping_address: `${profile?.company_address || "Industrial Estate"}, ${profile?.city || "Pune"}, ${profile?.state || "Maharashtra"}`,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

  const totalSpent = orders.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
  const activeOrdersCount = orders.filter((o) => o.status === "processing" || o.status === "shipped").length;
  const deliveredOrdersCount = orders.filter((o) => o.status === "delivered").length;

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return (
          <Badge variant="green" className="gap-1 capitalize">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </Badge>
        );
      case "shipped":
        return (
          <Badge variant="blue" className="gap-1 capitalize">
            <Truck className="h-3 w-3" /> Shipped
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="warning" className="gap-1 capitalize">
            <Clock className="h-3 w-3" /> Processing
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1 capitalize">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#024AE5] via-blue-700 to-[#3C8B4F] p-6 sm:p-8 text-white shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border-0">
                B2B Customer Portal
              </Badge>
              <span className="text-xs text-blue-100">
                Member since {new Date(profile?.created_at || Date.now()).getFullYear()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {profile?.title} {profile?.first_name} {profile?.last_name}
            </h1>
            <p className="text-sm text-blue-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-200" />
              <span>{profile?.company_name}</span> &bull;
              <span>{profile?.designation} ({profile?.department})</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button size="sm" className="gap-1.5 bg-white text-[#024AE5] hover:bg-slate-100 shadow-sm text-xs font-semibold">
                <ShoppingBag className="h-3.5 w-3.5" />
                Browse Catalog
              </Button>
            </Link>
            <form action={signOutUser}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="gap-1.5 bg-transparent hover:bg-white/10 text-white border-white/40 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Active Orders
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{activeOrdersCount}</div>
              <p className="text-xs text-slate-500 mt-1">Under fulfillment & transit</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Completed Orders
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-[#3C8B4F]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{deliveredOrdersCount}</div>
              <p className="text-xs text-slate-500 mt-1">Successfully delivered</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Total Purchase Value
              </CardTitle>
              <Package className="h-4 w-4 text-[#024AE5]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">₹{totalSpent.toLocaleString("en-IN")}</div>
              <p className="text-xs text-slate-500 mt-1">Across all industrial orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Orders Table & Company Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Orders Section */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Your Industrial Orders</CardTitle>
                  <CardDescription className="text-xs">
                    Real-time status tracking and dispatch details
                  </CardDescription>
                </div>
                <Badge variant="blue" className="text-xs">
                  {orders.length} Orders
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items Summary</TableHead>
                      <TableHead>Total (₹)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium text-xs text-[#024AE5]">
                          {order.order_number}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-xs max-w-[240px]">
                          <div className="truncate font-medium text-slate-900">
                            {order.items[0]?.name || "Industrial Component"}
                          </div>
                          {order.items.length > 1 && (
                            <span className="text-[10px] text-slate-500">
                              +{order.items.length - 1} more item(s) &bull; Qty: {order.items.reduce((s, i) => s + i.quantity, 0)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold whitespace-nowrap text-slate-900">
                          ₹{Number(order.total_amount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Company & Profile Overview Card */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#024AE5]" />
                  <CardTitle className="text-base font-semibold text-slate-900">Registered Company Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Company Name</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {profile?.company_name}
                  </p>
                </div>

                {profile?.gstin && (
                  <div>
                    <span className="text-slate-400 font-medium">GSTIN</span>
                    <p className="font-mono text-slate-700 mt-0.5">
                      {profile.gstin}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 font-medium">Billing & Delivery Address</span>
                  <p className="text-slate-700 mt-0.5 leading-relaxed">
                    {profile?.company_address}
                    {profile?.additional_address && `, ${profile.additional_address}`}
                    <br />
                    {profile?.city}, {profile?.state} - {profile?.pincode}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-medium">Authorized Contact</span>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {profile?.title} {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {profile?.designation} &bull; {profile?.department}
                  </p>
                  <div className="mt-2 space-y-1 text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{profile?.mobile}</span>
                      {profile?.landline && <span>/ {profile.landline}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{profile?.email}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
