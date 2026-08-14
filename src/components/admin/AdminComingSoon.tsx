import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ArrowLeft,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface AdminComingSoonProps {
  section: string;
  title: string;
  description: string;
  features?: string[];
  icon?: React.ComponentType<{ className?: string }>;
}

export function AdminComingSoon({
  title,
  description,
  features = [
    "Comprehensive data filtering and real-time search",
    "Bulk actions and multi-format export (Excel, CSV, PDF)",
    "Role-based permission gating and audit tracking",
    "Direct integration with ERP and accounting modules",
  ],
  icon: Icon = Layers,
}: AdminComingSoonProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <Badge variant="warning" className="gap-1 text-[11px] font-semibold">
              <Clock className="h-3 w-3" /> Coming Soon
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>

        <Link href="/admin/dashboard">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      </div>

      {/* Coming Soon Card */}
      <Card className="border border-slate-200 bg-white shadow-none rounded-2xl overflow-hidden p-8 sm:p-12 text-center">
        <CardContent className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-6 p-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#024AE5]/10 text-[#024AE5]">
            <Icon className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">
              {title} Module Under Development
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              This module is being configured with automated workflow engines, Supabase real-time sync, and enterprise export capabilities.
            </p>
          </div>

          {/* Planned Features List */}
          <div className="w-full text-left bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-[#024AE5]" />
              <span>Upcoming Capabilities:</span>
            </div>
            {features.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3C8B4F] shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link href="/admin/product-upload">
              <Button variant="primary" size="sm" className="text-xs">
                Go to Product Upload
              </Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="text-xs">
                Return to Overview
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
