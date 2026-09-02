"use client";

import React, { useState, useEffect } from "react";
import { Profile } from "@/types/database.types";
import { updateCustomerProfile } from "@/actions/customer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  ShieldCheck,
  Settings,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface CustomerProfileViewProps {
  initialProfile: Profile | null;
}

export function CustomerProfileView({ initialProfile }: CustomerProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState(initialProfile?.company_name || "");
  const [editFirstName, setEditFirstName] = useState(initialProfile?.first_name || "");
  const [editLastName, setEditLastName] = useState(initialProfile?.last_name || "");
  const [editMobile, setEditMobile] = useState(initialProfile?.mobile || "");
  const [editGstin, setEditGstin] = useState(initialProfile?.gstin || "");
  const [editAddress, setEditAddress] = useState(initialProfile?.company_address || "");
  const [editCity, setEditCity] = useState(initialProfile?.city || "");
  const [editState, setEditState] = useState(initialProfile?.state || "");
  const [editPincode, setEditPincode] = useState(initialProfile?.pincode || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setEditCompanyName(initialProfile.company_name || "");
      setEditFirstName(initialProfile.first_name || "");
      setEditLastName(initialProfile.last_name || "");
      setEditMobile(initialProfile.mobile || "");
      setEditGstin(initialProfile.gstin || "");
      setEditAddress(initialProfile.company_address || "");
      setEditCity(initialProfile.city || "");
      setEditState(initialProfile.state || "");
      setEditPincode(initialProfile.pincode || "");
    }
  }, [initialProfile]);

  const openEditModal = () => {
    if (profile) {
      setEditCompanyName(profile.company_name || "");
      setEditFirstName(profile.first_name || "");
      setEditLastName(profile.last_name || "");
      setEditMobile(profile.mobile || "");
      setEditGstin(profile.gstin || "");
      setEditAddress(profile.company_address || "");
      setEditCity(profile.city || "");
      setEditState(profile.state || "");
      setEditPincode(profile.pincode || "");
    }
    setIsEditProfileOpen(true);
  };

  const creditLimit = profile?.credit_limit || 0;
  const creditDays = profile?.credit_days || 0;
  const hasCreditFacility = creditLimit > 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const result = await updateCustomerProfile({
      company_name: editCompanyName,
      first_name: editFirstName,
      last_name: editLastName,
      mobile: editMobile,
      gstin: editGstin || null,
      company_address: editAddress,
      city: editCity,
      state: editState,
      pincode: editPincode,
    });

    setIsSavingProfile(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Company profile & delivery details updated successfully.");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              company_name: editCompanyName,
              first_name: editFirstName,
              last_name: editLastName,
              mobile: editMobile,
              gstin: editGstin,
              company_address: editAddress,
              city: editCity,
              state: editState,
              pincode: editPincode,
            }
          : null
      );
      setIsEditProfileOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Delivery Sites & Enterprise Profile
          </h1>
          <p className="text-xs text-slate-500">
            Manage your registered corporate entity, GSTIN, primary plant delivery address, and contact details.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openEditModal}
          className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs font-bold h-8.5 shadow-none gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Edit Profile & Addresses</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-8 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#024AE5]" />
              <h2 className="font-bold text-sm text-slate-900">Registered Enterprise & Facility Details</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Enterprise Entity Name</span>
              <span className="font-bold text-slate-900 text-sm">{profile?.company_name || "Enterprise Account"}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">GSTIN / Tax Identifier</span>
              <span className="font-mono font-bold text-slate-900">{profile?.gstin || "Not specified"}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Authorized Representative</span>
              <span className="font-semibold text-slate-800">{profile?.title} {profile?.first_name} {profile?.last_name}</span>
              <p className="text-slate-500 text-[11px]">{profile?.designation} &bull; {profile?.department}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Primary Contact Numbers</span>
              <span className="font-semibold text-slate-800">{profile?.mobile || "-"}</span>
              {profile?.landline && <p className="text-slate-500 text-[11px]">Landline: {profile.landline}</p>}
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[11px] font-semibold">Factory / Corporate Delivery Address</span>
              <p className="text-slate-800 font-medium leading-relaxed mt-0.5">
                {profile?.company_address || "Industrial MIDC Estate"}
                {profile?.additional_address && `, ${profile.additional_address}`}
                <br />
                {profile?.city || "Pune"}, {profile?.state || "Maharashtra"} - {profile?.pincode || "411001"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-4 p-6 bg-white border border-slate-200 shadow-none rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">Commercial Terms</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Payment Terms</span>
              <div className="font-bold text-slate-900 text-xs">Direct / Commercial Order Billing</div>
              <p className="text-[11px] text-slate-500">
                Official GST Tax Invoices generated upon dispatch.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Tax Exemption / GST</span>
              <div className="text-slate-700 font-medium">Standard CGST + SGST (18%)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#024AE5]" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Edit Enterprise Profile
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Update registered company name, GSTIN, and primary factory delivery address.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Company / Enterprise Name *</Label>
              <Input
                required
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                className="h-8.5 text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">First Name *</Label>
                <Input
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Last Name *</Label>
                <Input
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Mobile Phone *</Label>
                <Input
                  required
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">GSTIN (Optional)</Label>
                <Input
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value)}
                  placeholder="27AAAAA9999A1Z9"
                  className="h-8.5 text-xs border-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Factory / Billing Address *</Label>
              <Textarea
                required
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="min-h-[60px] text-xs border-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">City *</Label>
                <Input
                  required
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">State *</Label>
                <Input
                  required
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">PIN Code *</Label>
                <Input
                  required
                  value={editPincode}
                  onChange={(e) => setEditPincode(e.target.value)}
                  className="h-8.5 text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditProfileOpen(false)}
                disabled={isSavingProfile}
                className="h-8 text-xs border-slate-200 shadow-none cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="h-8 text-xs bg-[#024AE5] hover:bg-[#024AE5]/90 text-white shadow-none px-5 font-bold cursor-pointer"
              >
                {isSavingProfile && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save Profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
