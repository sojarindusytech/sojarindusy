import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Factory, Award, Target, Users2, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Sojar Indusy",
  description: "Learn about Sojar Indusy - Industrial manufacturing leaders in precision engineering and high-performance components.",
};

export default function AboutPage() {
  const values = [
    {
      icon: <Award className="h-6 w-6 text-blue-600" />,
      title: "Precision Engineering",
      desc: "Machining and forging components with strict micron-level dimensional controls and metallurgical integrity.",
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-emerald-600" />,
      title: "Certified Compliance",
      desc: "Adherence to international manufacturing standards including ASTM, DIN, ISO, and ASME specifications.",
    },
    {
      icon: <Factory className="h-6 w-6 text-indigo-600" />,
      title: "Modern Manufacturing",
      desc: "State-of-the-art CNC machine centers, automated thread rolling, and specialized heat treatment facilities.",
    },
    {
      icon: <Target className="h-6 w-6 text-amber-600" />,
      title: "On-Time Dispatch",
      desc: "Dedicated supply chain logistics ensuring predictable deliveries to project sites across India.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-12">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="outline" className="text-xs">About Sojar Indusy</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Engineering the Backbone of Modern Industry
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Sojar Indusy is an industrial manufacturing and supply chain pioneer dedicated to delivering high-performance fasteners, industrial valves, and engineered metal components to infrastructure and manufacturing powerhouses.
          </p>
        </div>

        {/* Story Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Our Vision & Capabilities
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              We bridge the gap between heavy industrial manufacturing and modern digital commerce. Through our integrated B2B digital portal, corporate clients and procurement managers can track orders in real-time, view material test certificates, and configure bespoke manufacturing batches with complete transparency.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Our infrastructure is engineered to serve automotive tier-1s, power generation plants, petrochemical refineries, and heavy equipment manufacturers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/80 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Operational Standards
            </h3>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <span><strong>ISO 9001:2015</strong> Certified Quality Management System</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <span><strong>EN 10204 3.1</strong> Traceable Inspection Certificates</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <span><strong>Hydrostatic & Spectro</strong> Quality Testing In-House</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <span><strong>GSTIN Verified</strong> Corporate Billing & E-Way Bills</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
          {values.map((v, idx) => (
            <Card key={idx} className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="p-6 pb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 mb-2">
                  {v.icon}
                </div>
                <CardTitle className="text-lg font-semibold">{v.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {v.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center pt-8 border-t border-slate-200 dark:border-slate-800">
          <Link href="/signup">
            <Button size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <span>Join as a Corporate Partner</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
