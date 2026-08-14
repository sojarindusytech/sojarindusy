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
  Layers,
  CheckCircle2,
  Clock,
  Building2,
  Users,
} from "lucide-react";

export default function HomePage() {
  const categories = [
    {
      title: "Precision Industrial Fasteners",
      grade: "Grade 8.8 / 10.9 / SS316",
      desc: "High-tensile bolts, nuts, studs, socket screws, and custom anchors for heavy machinery.",
      status: "Catalog Coming Soon",
    },
    {
      title: "High-Pressure Industrial Valves",
      grade: "Class 150 - 2500 / PN16-PN100",
      desc: "Ball valves, gate valves, globe valves, check valves, and butterfly valves.",
      status: "Catalog Coming Soon",
    },
    {
      title: "CNC Machined Flanges & Collars",
      grade: "EN8 / SS304 / Forged Alloy",
      desc: "Weld neck, slip-on, blind, and threaded flanges machined to exact micrometric tolerances.",
      status: "Catalog Coming Soon",
    },
    {
      title: "Hydraulic Fittings & Manifolds",
      grade: "BSP / NPT / Metric Standards",
      desc: "Leak-proof hydraulic adapters, high-pressure couplings, and specialized fluid manifolds.",
      status: "Catalog Coming Soon",
    },
  ];

  const features = [
    {
      icon: <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
      title: "Certified Mill Quality",
      description: "Every component is supplied with EN 10204 3.1 MTC inspection certificates and test reports.",
    },
    {
      icon: <Truck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
      title: "Real-Time Order Tracking",
      description: "Track procurement orders from shop floor production, dispatch, and final site delivery.",
    },
    {
      icon: <FileCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
      title: "Automated GST Invoicing",
      description: "Seamless B2B billing with GSTIN verification, e-way bills, and digital purchase orders.",
    },
    {
      icon: <Factory className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
      title: "OEM & Bulk Manufacturing",
      description: "Direct-from-manufacturer pricing with flexible MOQs for tier-1 industrial clients.",
    },
  ];

  return (
    <div className="relative isolate overflow-hidden">
      {/* Background Decorative Gradients */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-600 via-indigo-500 to-amber-300 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="container mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur-md dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
          <span>Next-Gen B2B Industrial Marketplace &bull; Launching Soon</span>
        </div>

        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Industrial Procurement, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent">
              Engineered for Speed & Scale
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Sojar Indusy is building India&apos;s premier digital platform for precision engineering components, heavy valves, fasteners, and custom manufactured hardware.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href="/signup">
            <Button size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/25 px-8">
              <span>Register Your Company</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="px-8 shadow-sm">
              Sign In to Dashboard
            </Button>
          </Link>
        </div>

        {/* Coming Soon Highlights Bar */}
        <div className="pt-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-md backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">10,000+</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">SKUs in Pipeline</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Tested & Certified</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Pan-India</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Supply Logistics</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">B2B Portal</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Instant Invoicing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories Section */}
      <section className="border-t border-slate-200/80 bg-slate-100/50 py-16 dark:border-slate-800 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-xs">Product Lineup</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Engineered Manufacturing Capabilities
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Explore our upcoming high-specification product verticals designed for aerospace, automotive, energy, and infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, idx) => (
              <Card key={idx} className="group transition-all hover:shadow-lg hover:border-blue-500/40">
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
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-2">
                    {cat.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
      <section className="py-16">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-xs">Enterprise Advantages</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Built for Modern Industrial Supply Chains
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Eliminating friction in B2B procurement with transparent pricing, instant traceability, and dedicated corporate support.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <Card key={idx} className="border-slate-200/80 dark:border-slate-800">
                <CardHeader className="p-5 pb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 mb-2">
                    {feat.icon}
                  </div>
                  <CardTitle className="text-base font-semibold">{feat.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-8 sm:p-12 text-white shadow-2xl text-center space-y-6">
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
              <Button size="lg" variant="secondary" className="gap-2 shadow-lg text-slate-900">
                <span>Create B2B Account</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10">
                Member Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
