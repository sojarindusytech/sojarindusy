"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, LogOut, Mail, Phone, ShoppingBag, XCircle } from "lucide-react";
import type { Profile } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutUser } from "@/actions/auth";

interface Props {
  user: { id: string; email: string };
  profile: Profile | null;
  supportEmail: string;
  supportPhone: string | null;
}

/** Shown to a signed-in account whose application an administrator has rejected. */
export function ApplicationRejectedClient({ user, profile, supportEmail, supportPhone }: Props) {
  const fullName = profile ? `${profile.title || "Mr"} ${profile.first_name} ${profile.last_name}` : "Valued Partner";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="h-16 border-b border-slate-200 bg-white px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" title="Sojar Solutions Home" className="flex items-center">
          <Image src="/assets/sojar-logo.svg" alt="Sojar Solutions" width={160} height={44} className="h-9 w-auto object-contain" priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="outline" size="sm" className="text-xs border-slate-200 gap-1.5 shadow-none hidden sm:inline-flex">
              <ShoppingBag className="h-3.5 w-3.5 text-[#024AE5]" />
              <span>Browse Products</span>
            </Button>
          </Link>
          <form action={signOutUser}>
            <Button type="submit" variant="ghost" size="sm" className="text-xs text-red-600 hover:bg-red-50 gap-1.5 cursor-pointer">
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-300/60 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <XCircle className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                Application Not Approved
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{fullName}</h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We reviewed the enterprise account application for{" "}
            <strong className="text-slate-900">{profile?.company_name || "your organization"}</strong> and were not able to approve it at this
            time. Pricing, ordering and the customer dashboard stay locked for this account. If you think this is a mistake, or your details
            have changed, please contact us and we will look at it again.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="h-4 w-4 text-[#024AE5]" />
              <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Application</h2>
            </div>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-400 text-[10px] uppercase font-bold">Company</dt>
                <dd className="font-bold text-slate-900">{profile?.company_name || "-"}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[10px] uppercase font-bold">GSTIN</dt>
                <dd className="font-mono font-bold text-slate-900">{profile?.gstin || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[10px] uppercase font-bold">Signed in as</dt>
                <dd className="font-semibold text-slate-800">{user.email}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Mail className="h-4 w-4 text-[#024AE5]" />
              <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Contact Us</h2>
            </div>
            <div className="space-y-2.5 text-xs">
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent("Account application review")}`}
                className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-lg font-semibold text-slate-900 hover:bg-blue-50"
              >
                <Mail className="h-3.5 w-3.5 text-[#024AE5]" />
                {supportEmail}
              </a>
              {supportPhone ? (
                <a href={`tel:${supportPhone}`} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 hover:bg-slate-100">
                  <Phone className="h-3.5 w-3.5 text-[#024AE5]" />
                  {supportPhone}
                </a>
              ) : null}
            </div>
          </Card>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} Sojar Solutions &bull; Plot No. 7, GIDC Char Rasta, Vapi, Gujarat, India
      </footer>
    </div>
  );
}
