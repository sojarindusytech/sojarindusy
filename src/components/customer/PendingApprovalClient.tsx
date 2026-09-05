"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Profile } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Clock,
  ShieldAlert,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  ShoppingBag,
  LogOut,
  CheckCircle2,
  Check,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { signOutUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface PendingApprovalClientProps {
  user: { id: string; email: string };
  profile: Profile | null;
}

export function PendingApprovalClient({
  user,
  profile,
}: PendingApprovalClientProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.loading("Checking verification status with server...", { id: "refresh-status" });
    setTimeout(() => {
      router.refresh();
      setIsRefreshing(false);
      toast.dismiss("refresh-status");
      toast("Status rechecked. If approved, you will be redirected automatically.", { icon: "ℹ️" });
    }, 1000);
  };

  const fullName = profile
    ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}`
    : "Valued Partner";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Simple Header */}
      <header className="h-16 border-b border-slate-200 bg-white px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/sojar-logo.webp"
            alt="Sojar Indusy"
            width={160}
            height={44}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="hidden sm:inline-block text-[11px] font-bold text-[#024AE5] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wider">
            Customer Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-slate-200 gap-1.5 h-8.5 shadow-none hidden sm:inline-flex"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[#024AE5]" />
              <span>Browse Products</span>
            </Button>
          </Link>
          <form action={signOutUser}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-xs text-red-600 hover:bg-red-50 gap-1.5 h-8.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </header>

      {/* Main Pending Card Body */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Status Notification Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                  Account Pending Administrator Approval
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Welcome, {fullName}
                </h1>
              </div>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-9 px-4 shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Check Verification Status</span>
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            Your enterprise account for <strong className="text-slate-900">{profile?.company_name || "your organization"}</strong> is currently awaiting commercial verification by the Sojar Indusy administrative team. Once approved, live industrial pricing, credit facilities, automated ordering, and courier tracking will be unlocked.
          </p>
        </div>

        {/* 3-Step Verification Timeline Card */}
        <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Verification & Activation Progress
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Step 1</span>
                <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  <Check className="h-3 w-3" />
                </span>
              </div>
              <h3 className="text-xs font-bold text-emerald-950">Registration Submitted</h3>
              <p className="text-[11px] text-emerald-700">
                Company & contact details logged securely.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 space-y-2 relative ring-2 ring-amber-400/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Step 2 (Active)</span>
                <span className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">
                  2
                </span>
              </div>
              <h3 className="text-xs font-bold text-amber-950">Administrative Review</h3>
              <p className="text-[11px] text-amber-800">
                GSTIN & commercial credit terms verification in progress.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 opacity-70">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Step 3</span>
                <span className="h-5 w-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-700">Portal Activation</h3>
              <p className="text-[11px] text-slate-500">
                Access to direct procurement & consignment tracking.
              </p>
            </div>
          </div>
        </Card>

        {/* Two-Column Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Registered Application Details (7 Cols) */}
          <Card className="md:col-span-7 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="h-4 w-4 text-[#024AE5]" />
              <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Submitted Application Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Company Name</span>
                <span className="font-bold text-slate-900">{profile?.company_name || "Enterprise Account"}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">GSTIN</span>
                <span className="font-mono font-bold text-slate-900">{profile?.gstin || "Not provided"}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Representative</span>
                <span className="font-semibold text-slate-800">{fullName}</span>
                <p className="text-slate-500 text-[11px]">{profile?.designation || "Procurement Officer"} ({profile?.department || "Operations"})</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Details</span>
                <span className="font-semibold text-slate-800">{profile?.mobile || "-"}</span>
                <p className="text-slate-500 text-[11px]">{user.email}</p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Plant / Delivery Address</span>
                <p className="text-slate-700 mt-0.5 leading-relaxed">
                  {profile?.company_address || "MIDC Industrial Estate"}
                  <br />
                  {profile?.city || "Pune"}, {profile?.state || "Maharashtra"} - {profile?.pincode || "411001"}
                </p>
              </div>
            </div>
          </Card>

          {/* Expedite Activation & Support (5 Cols) */}
          <Card className="md:col-span-5 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="h-4 w-4 text-[#024AE5]" />
              <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Expedite Activation Desk
              </h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Have urgent tooling requirements or need immediate account approval for a scheduled production run?
            </p>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">
                  Priority Activation Desk
                </span>
                <div className="font-mono font-bold text-slate-900 text-xs">
                  +91 (020) 2712-8940 / +91 98765 43210
                </div>
                <span className="text-[10px] text-slate-500 block">Mon – Sat (08:30 AM – 07:00 PM IST)</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Support Email
                </span>
                <div className="font-medium text-slate-800 text-xs">
                  admin@sojarindusy.com
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} Sojar Indusy Tech &bull; Bhosari MIDC Industrial Estate, Pune, Maharashtra.
      </footer>
    </div>
  );
}
