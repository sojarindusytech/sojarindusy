import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  FileCheck,
  Factory,
  Clock,
} from "lucide-react";

export default function HomePage() {
  const categories = [
    {
      title: "Precision Industrial Fasteners",
      grade: "Grade 8.8 / 10.9 / SS316",
      desc: "High-tensile bolts, nuts, studs, socket screws, and custom anchors for heavy machinery.",
      status: "Catalog Coming Soon",
      accent: "blue",
    },
    {
      title: "High-Pressure Industrial Valves",
      grade: "Class 150 - 2500 / PN16-PN100",
      desc: "Ball valves, gate valves, globe valves, check valves, and butterfly valves.",
      status: "Catalog Coming Soon",
      accent: "green",
    },
    {
      title: "CNC Machined Flanges & Collars",
      grade: "EN8 / SS304 / Forged Alloy",
      desc: "Weld neck, slip-on, blind, and threaded flanges machined to exact micrometric tolerances.",
      status: "Catalog Coming Soon",
      accent: "blue",
    },
    {
      title: "Hydraulic Fittings & Manifolds",
      grade: "BSP / NPT / Metric Standards",
      desc: "Leak-proof hydraulic adapters, high-pressure couplings, and specialized fluid manifolds.",
      status: "Catalog Coming Soon",
      accent: "green",
    },
  ];

  const features = [
    {
      icon: <ShieldCheck className="h-6 w-6 text-[#024AE5]" />,
      title: "Certified Mill Quality",
      description: "Every component is supplied with EN 10204 3.1 MTC inspection certificates and test reports.",
    },
    {
      icon: <Truck className="h-6 w-6 text-[#3C8B4F]" />,
      title: "Real-Time Order Tracking",
      description: "Track procurement orders from shop floor production, dispatch, and final site delivery.",
    },
    {
      icon: <FileCheck className="h-6 w-6 text-[#024AE5]" />,
      title: "Automated GST Invoicing",
      description: "Seamless B2B billing with GSTIN verification, e-way bills, and digital purchase orders.",
    },
    {
      icon: <Factory className="h-6 w-6 text-[#3C8B4F]" />,
      title: "OEM & Bulk Manufacturing",
      description: "Direct-from-manufacturer pricing with flexible MOQs for tier-1 industrial clients.",
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Welcome Hero Section (Directly Below Header) */}
      <section className="container mx-auto max-w-6xl px-4 py-16 sm:py-24 sm:px-6 border-b border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start justify-between">
          {/* Left Column: Heading */}
          <div className="md:col-span-7 lg:col-span-7">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Welcome to the <br />
              Sojar Indusy
            </h1>
          </div>

          {/* Right Column: Narrative & Action */}
          <div className="md:col-span-5 lg:col-span-5 space-y-6 pt-1 md:pt-2">
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
              We apply our expert minds and collaborative ways of working with customers to build more resilient and stronger businesses.
            </p>
            <div>
              <Link href="/products">
                <Button className="bg-[#024AE5] hover:bg-[#0238B0] text-white font-medium text-xs sm:text-sm px-6 py-2.5 h-auto rounded-none shadow-none transition-colors cursor-pointer">
                  View our offerings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories Section */}
      <section className="border-t border-slate-200 bg-slate-50/60 py-16">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="blue" className="text-xs">Product Lineup</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Engineered Manufacturing Capabilities
            </h2>
            <p className="text-sm text-slate-500">
              Explore our upcoming high-specification product verticals designed for aerospace, automotive, energy, and infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, idx) => (
              <Card key={idx} className="group transition-all hover:border-[#024AE5]/40 bg-white shadow-none">
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {cat.grade}
                    </Badge>
                    <Badge variant="warning" className="text-[11px]">
                      <Clock className="h-3 w-3 mr-1" />
                      {cat.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900 pt-2">
                    {cat.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {cat.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center pt-4">
            <Link href="/products">
              <Button variant="outline" className="gap-2">
                <span>View Full Catalog Preview</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Sojar Indusy */}
      <section className="py-16 bg-white">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="green" className="text-xs">Enterprise Advantages</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Built for Modern Industrial Supply Chains
            </h2>
            <p className="text-sm text-slate-500">
              Eliminating friction in B2B procurement with transparent pricing, instant traceability, and dedicated corporate support.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <Card key={idx} className="border-slate-200 bg-white hover:border-slate-300">
                <CardHeader className="p-5 pb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-2 border border-slate-100">
                    {feat.icon}
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900">{feat.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {feat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pre-Registration Banner */}
      <section className="container mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-[#024AE5] via-blue-700 to-[#3C8B4F] p-8 sm:p-12 text-white shadow-xl text-center space-y-6">
          <div className="space-y-2 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold">
              Ready to Upgrade Your Industrial Procurement?
            </h3>
            <p className="text-sm text-blue-100">
              Register your business account today to receive priority catalog access, custom credit terms, and direct factory pricing.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="gap-2 bg-white text-[#024AE5] hover:bg-slate-100 shadow-md">
                <span>Create B2B Account</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="bg-transparent border-white/60 text-white hover:bg-white/15">
                Member Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
