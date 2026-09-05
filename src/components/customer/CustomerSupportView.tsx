"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Headphones, Truck, Phone, Mail, Clock, ShieldCheck, MapPin } from "lucide-react";

export function CustomerSupportView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Technical Support & Logistics Helpdesk
        </h1>
        <p className="text-xs text-slate-500">
          Direct engineering assistance for machining parameters, tooling selection, custom orders, and consignment dispatch coordination.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Headphones className="h-5 w-5 text-[#024AE5]" />
            <h2 className="font-bold text-sm text-slate-900">Tooling & Engineering Support</h2>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Have technical questions regarding cutting speed (Vc), feed per tooth (Fz), workpiece machinability, or custom tooling tolerances?
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <Phone className="h-4 w-4 text-[#024AE5]" />
                <div>
                  <span className="font-bold text-slate-900 block">Direct Technical Hotline</span>
                  <span className="text-slate-600 font-mono">+91 (020) 2712-8940 / +91 98765 43210</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <Mail className="h-4 w-4 text-slate-600" />
                <div>
                  <span className="font-bold text-slate-900 block">Engineering Desk Email</span>
                  <span className="text-slate-600">engineering@sojarindusy.com</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="h-5 w-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">Dispatch & E-Way Bill Logistics Desk</h2>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-slate-600 leading-relaxed">
              For urgent consignment tracking, carrier changes, or multi-site drop shipment delivery coordination.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Warehouse Location</span>
              <div className="font-bold text-slate-900">Sojar Indusy Tech MIDC Logistics Hub</div>
              <div className="text-slate-500">Phase 1 MIDC Industrial Area, Chinchwad, Pune - 411019</div>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Dispatch Hours: Mon – Sat (08:30 AM to 07:00 PM IST)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
