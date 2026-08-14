import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Truck,
  FileCheck,
  Factory,
  Clock,
  CheckCircle2,
  Lock,
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
      {/* Hero Section */}
      <section className="container mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#024AE5]/20 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold text-[#024AE5] shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-[#024AE5] animate-pulse" />
          <span>Next-Gen B2B Industrial Marketplace &bull; Launching Soon</span>
        </div>

        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Industrial Procurement, <br className="hidden sm:inline" />
            <span className="text-[#024AE5]">
              Engineered for Speed & Scale
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Sojar Indusy is building India&apos;s premier digital platform for precision engineering components, heavy valves, fasteners, and custom manufactured hardware.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href="/signup">
            <Button size="lg" variant="primary" className="gap-2 px-8">
              <span>Register Your Company</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline-green" className="px-8">
              Sign In to Dashboard
            </Button>
          </Link>
        </div>

        {/* Highlights Bar */}
        <div className="pt-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-[#024AE5]">10,000+</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">SKUs in Pipeline</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-[#3C8B4F]">100%</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Tested & Certified</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-[#024AE5]">Pan-India</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Supply Logistics</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-[#3C8B4F]">B2B Portal</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Instant Invoicing</div>
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
