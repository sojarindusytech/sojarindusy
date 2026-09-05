import { getCurrentUserProfile } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck,
  Building2,
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  UploadCloud,
  FileSpreadsheet,
  Users,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { Order, Profile } from "@/types/database.types";
import { ORDER_STATUSES, ORDER_STATUS_CONFIG } from "@/lib/constants";

export default async function AdminDashboardPage() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  const userRole = profile?.role;
  if (userRole !== "admin" && userRole !== "platform_owner") {
    redirect("/dashboard");
  }

  // Fetch all orders & all profiles using Supabase (Platform Owner permissions)
  const supabase = await createClient();
  const { data: dbOrders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: dbProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Sample data fallback for visualization
  const orders: Order[] =
    dbOrders && dbOrders.length > 0
      ? (dbOrders as Order[])
      : [
          {
            id: "ord-101",
            user_id: user.id,
            order_number: "ORD-2026-9042",
            status: "pending",
            total_amount: 320000,
            items: [
              {
                id: "1",
                name: "Forged Steel Industrial Gate Valve DN150 PN16",
                sku: "VALV-FS-DN150",
                quantity: 15,
                unit_price: 21333,
                total_price: 320000,
              },
            ],
            shipping_address: "Plot 12, Bhosari MIDC, Pune, Maharashtra",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "ord-102",
            user_id: user.id,
            order_number: "ORD-2026-8941",
            status: "processing",
            total_amount: 145200,
            items: [
              {
                id: "2",
                name: "High-Tensile Hex Bolt M16 x 60mm (Grade 8.8)",
                sku: "FAST-HTB-M16",
                quantity: 2500,
                unit_price: 32,
                total_price: 80000,
              },
              {
                id: "3",
                name: "Stainless Steel SS316 Ball Valve 2 inch",
                sku: "VALV-SS316-2IN",
                quantity: 12,
                unit_price: 5433,
                total_price: 65200,
              },
            ],
            shipping_address: "Plot 45, Chakan Industrial Area Phase 2, Pune",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "ord-103",
            user_id: user.id,
            order_number: "ORD-2026-8712",
            status: "delivered",
            total_amount: 89500,
            items: [
              {
                id: "4",
                name: "Precision CNC Flange Collar (EN8 Steel)",
                sku: "PREC-FLG-EN8",
                quantity: 150,
                unit_price: 596.66,
                total_price: 89500,
              },
            ],
            shipping_address: "GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

  const clients: Profile[] =
    dbProfiles && dbProfiles.length > 0
      ? (dbProfiles as Profile[])
      : [
          {
            id: "client-1",
            role: "customer",
            title: "Mr",
            first_name: "Rajesh",
            last_name: "Sharma",
            department: "Procurement",
            designation: "General Manager",
            mobile: "9876543210",
            email: "r.sharma@apexengineering.com",
            company_name: "Apex Precision Engineering Pvt Ltd",
            company_address: "Plot 45, Chakan Industrial Area Phase 2",
            gstin: "27AAAAA0000A1Z5",
            city: "Pune",
            state: "Maharashtra",
            pincode: "410501",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "client-2",
            role: "customer",
            title: "Ms",
            first_name: "Pooja",
            last_name: "Deshmukh",
            department: "Supply Chain",
            designation: "Head of Operations",
            mobile: "9823012345",
            email: "pooja@torkmachinery.in",
            company_name: "Tork Heavy Industries Ltd",
            company_address: "Sector 18, Industrial Hub",
            gstin: "27BBBBB1111B2Z6",
            city: "Aurangabad",
            state: "Maharashtra",
            pincode: "431001",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

  const totalRevenue = orders.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length;

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case ORDER_STATUSES.DELIVERED:
        return (
          <Badge variant="green" className="gap-1 capitalize">
            <CheckCircle2 className="h-3 w-3" /> {ORDER_STATUS_CONFIG[ORDER_STATUSES.DELIVERED].label}
          </Badge>
        );
      case ORDER_STATUSES.SHIPPED:
        return (
          <Badge variant="blue" className="gap-1 capitalize">
            <Truck className="h-3 w-3" /> {ORDER_STATUS_CONFIG[ORDER_STATUSES.SHIPPED].label}
          </Badge>
        );
      case ORDER_STATUSES.PROCESSING:
        return (
          <Badge variant="warning" className="gap-1 capitalize">
            <Clock className="h-3 w-3" /> {ORDER_STATUS_CONFIG[ORDER_STATUSES.PROCESSING].label}
          </Badge>
        );
      case ORDER_STATUSES.PENDING:
        return (
          <Badge variant="secondary" className="gap-1 capitalize">
            {ORDER_STATUS_CONFIG[ORDER_STATUSES.PENDING].label}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Admin Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#024AE5] to-[#013bb8] p-6 text-white shadow-none">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-[#3C8B4F] text-white border-0 text-[11px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> Platform Owner Console
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {profile?.first_name || "Admin"}
          </h1>
          <p className="text-xs text-blue-100">
            Industrial Operations & Multi-Module Enterprise Command Center
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/products?upload=true">
            <Button size="sm" className="bg-white text-[#024AE5] hover:bg-slate-100 text-xs font-semibold gap-1.5 shadow-none">
              <UploadCloud className="h-4 w-4" />
              <span>Upload Products (Excel)</span>
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" variant="outline" className="text-xs border-white/30 text-white bg-white/10 hover:bg-white/20 shadow-none">
              Customer View
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Pipeline Volume
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#3C8B4F]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString("en-IN")}</div>
            <p className="text-xs text-slate-500 mt-1">Total orders processed</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Pending Actions
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{pendingOrders}</div>
            <p className="text-xs text-slate-500 mt-1">Orders awaiting dispatch</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Total Orders
            </CardTitle>
            <Package className="h-4 w-4 text-[#024AE5]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
            <p className="text-xs text-slate-500 mt-1">Active platform transactions</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Registered Clients
            </CardTitle>
            <Building2 className="h-4 w-4 text-[#3C8B4F]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{clients.length}</div>
            <p className="text-xs text-slate-500 mt-1">Verified B2B corporate buyers</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Module Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/admin/products?upload=true" className="group">
          <Card className="border-slate-200 bg-white hover:border-[#024AE5] hover:bg-blue-50/20 transition-all p-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#024AE5]" />
                <span className="text-xs font-semibold text-slate-800 group-hover:text-[#024AE5]">Product Upload</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#024AE5]" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/customers" className="group">
          <Card className="border-slate-200 bg-white hover:border-[#024AE5] hover:bg-blue-50/20 transition-all p-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#3C8B4F]" />
                <span className="text-xs font-semibold text-slate-800 group-hover:text-[#024AE5]">Customers</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#024AE5]" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/invoices" className="group">
          <Card className="border-slate-200 bg-white hover:border-[#024AE5] hover:bg-blue-50/20 transition-all p-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-semibold text-slate-800 group-hover:text-[#024AE5]">Tax Invoices</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#024AE5]" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/orders" className="group">
          <Card className="border-slate-200 bg-white hover:border-[#024AE5] hover:bg-blue-50/20 transition-all p-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-slate-800 group-hover:text-[#024AE5]">All Orders</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#024AE5]" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Global Orders Management Table */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Recent Global Orders</CardTitle>
            <CardDescription className="text-xs">
              Live manufacturing order stream and fulfillment stages
            </CardDescription>
          </div>
          <Badge variant="blue" className="text-xs w-fit">
            {orders.length} Orders
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Order #</TableHead>
                <TableHead className="text-xs">Customer / Delivery</TableHead>
                <TableHead className="text-xs">Items & Quantity</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Current Status</TableHead>
                <TableHead className="text-right text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium text-xs text-[#024AE5]">
                    {order.order_number}
                    <div className="text-[10px] text-slate-400 font-sans">
                      {new Date(order.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-semibold text-slate-800">
                      {order.shipping_address.split(",")[0]}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                      {order.shipping_address}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs max-w-[240px]">
                    <div className="truncate font-medium text-slate-900">
                      {order.items[0]?.name}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Qty: {order.items.reduce((s, i) => s + i.quantity, 0)} units
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-semibold whitespace-nowrap text-slate-900">
                    ₹{Number(order.total_amount).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Registered B2B Clients Directory */}
      <Card className="border-slate-200 bg-white shadow-none rounded-xl">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#024AE5]" />
            <CardTitle className="text-base font-bold text-slate-900">Registered B2B Client Directory</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Verified corporate buyers and procurement managers
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Company Name</TableHead>
                <TableHead className="text-xs">Authorized Contact</TableHead>
                <TableHead className="text-xs">GSTIN</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Mobile / Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="text-xs font-semibold text-slate-900">
                    {client.company_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{client.title} {client.first_name} {client.last_name}</div>
                    <div className="text-[10px] text-slate-500">{client.designation} ({client.department})</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {client.gstin || "Unregistered"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {client.city}, {client.state}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="text-slate-800">{client.mobile}</div>
                    <div className="text-[10px] text-slate-400">{client.email}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
