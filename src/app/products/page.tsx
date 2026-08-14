import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ShieldCheck, ShoppingBag, ArrowRight, Filter, Sparkles, Layers } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Industrial Product Catalog | Sojar Indusy",
  description: "Browse high-precision fasteners, industrial valves, flanges, and engineered components by Sojar Indusy.",
};

export default function ProductsPage() {
  const products = [
    {
      name: "High-Tensile Hex Bolt M16 x 60mm",
      category: "Fasteners",
      sku: "FAST-HTB-M16",
      material: "Alloy Steel (Grade 8.8 / 10.9)",
      standard: "DIN 933 / ISO 4017",
      moq: "500 pcs",
      status: "Coming Soon for Direct Ordering",
    },
    {
      name: "Stainless Steel SS316 Ball Valve 2 Inch",
      category: "Valves",
      sku: "VALV-SS316-2IN",
      material: "CF8M / SS316",
      standard: "API 6D / ASME B16.34",
      moq: "5 pcs",
      status: "Coming Soon for Direct Ordering",
    },
    {
      name: "Forged Steel Gate Valve DN150 PN16",
      category: "Valves",
      sku: "VALV-FS-DN150",
      material: "A105 Forged Carbon Steel",
      standard: "BS 5352 / API 602",
      moq: "2 pcs",
      status: "Coming Soon for Direct Ordering",
    },
    {
      name: "Precision CNC Flange Collar (EN8 Steel)",
      category: "Flanges",
      sku: "PREC-FLG-EN8",
      material: "EN8 / 080M40",
      standard: "ASME B16.5 Class 150",
      moq: "25 pcs",
      status: "Coming Soon for Direct Ordering",
    },
    {
      name: "Heavy-Duty Stud Bolt with 2 Heavy Hex Nuts",
      category: "Fasteners",
      sku: "FAST-STB-B7",
      material: "ASTM A193 Grade B7 / 2H",
      standard: "ASME B18.31.2",
      moq: "250 pcs",
      status: "Coming Soon for Direct Ordering",
    },
    {
      name: "Hydraulic High-Pressure Male Stud Adapter",
      category: "Fittings",
      sku: "HYD-ADPT-BSP",
      material: "Zinc-Plated Steel",
      standard: "ISO 8434-1 / DIN 2353",
      moq: "50 pcs",
      status: "Coming Soon for Direct Ordering",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                Product Catalog
              </Badge>
              <Badge variant="warning" className="gap-1 text-xs">
                <Clock className="h-3 w-3" /> Launching Soon
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Industrial Components & Assemblies
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Engineered hardware certified for high-pressure, thermal, and mechanical stress environments.
            </p>
          </div>

          <Link href="/signup">
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
              <span>Register for B2B Pricing</span>
            </Button>
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((item, idx) => (
            <Card key={idx} className="flex flex-col justify-between transition-all hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {item.category}
                  </Badge>
                  <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                </div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 pt-2 line-clamp-2">
                  {item.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-100/70 dark:bg-slate-900/70 p-3 space-y-1.5 border border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Material Grade:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.material}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Standard:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{item.standard}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Min. Order Qty (MOQ):</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{item.moq}</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0 border-t border-slate-100 dark:border-slate-800/50 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Coming Soon</span>
                </div>
                <Link href="/signup">
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    Get Quote
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
