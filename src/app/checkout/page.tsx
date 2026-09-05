"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { createCustomerOrder } from "@/actions/order";
import { getCurrentUserProfile } from "@/actions/auth";
import { Profile } from "@/types/database.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingBag,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Truck,
  ArrowLeft,
  Loader2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, gstAmount, totalAmount, clearCart } = useCart();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { user, profile: userProfile } = await getCurrentUserProfile();
        if (!user) {
          router.push(`/login?redirect=${encodeURIComponent("/checkout")}`);
          return;
        }
        setUserEmail(user.email);
        if (userProfile) {
          setProfile(userProfile);
          setDeliveryAddress(
            `${userProfile.company_address || ""}, ${userProfile.city || ""}, ${userProfile.state || ""} - ${userProfile.pincode || ""}`.trim()
          );
        }
      } catch (err) {
        console.error("Error loading profile for checkout:", err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadUser();
  }, [router]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error("Please enter a valid factory/site delivery address.");
      return;
    }

    setIsSubmitting(true);

    const notesSummary = [
      poNumber ? `Client PO Ref: ${poNumber}` : null,
      orderNotes ? `Delivery Notes: ${orderNotes}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const result = await createCustomerOrder({
      items: items.map((item) => ({
        variantId: item.variantId,
        name: item.title,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        specifications: item.specifications,
      })),
      shippingAddress: deliveryAddress,
      notes: notesSummary || undefined,
    });

    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      clearCart();
      toast.success(`Purchase Order #${result.orderNumber} placed successfully!`);
      router.push("/dashboard");
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#024AE5] animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          You haven&apos;t added any SKUs to your order yet. Browse our tooling catalog to select products.
        </p>
        <Link href="/products">
          <Button className="bg-[#024AE5] hover:bg-[#024AE5]/90 text-white text-xs h-9 shadow-none">
            Browse Product Catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6">
      <div className="container mx-auto max-w-5xl">
        {/* Header Navigation */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/products"
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#024AE5] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              B2B Purchase Order Checkout
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verify registered billing details, delivery location, and confirm order placement.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> GST Tax Invoice
          </span>
        </div>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Delivery & Client Info */}
          <div className="lg:col-span-7 space-y-6">
            {/* Registered Company Card */}
            <Card className="p-5 border border-slate-200 shadow-none bg-white rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#024AE5]" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Registered Enterprise Details
                  </h3>
                </div>
                {profile?.gstin && (
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    GSTIN: {profile.gstin}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Company Name</span>
                  <span className="font-semibold text-slate-800">
                    {profile?.company_name || "Industrial Client"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Authorized Contact</span>
                  <span className="font-semibold text-slate-800">
                    {profile ? `${profile.title} ${profile.first_name} ${profile.last_name}` : "Purchasing Agent"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{userEmail}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{profile?.mobile || "-"}</span>
                </div>
              </div>
            </Card>

            {/* Delivery Location & Reference Details */}
            <Card className="p-5 border border-slate-200 shadow-none bg-white rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <MapPin className="h-4 w-4 text-[#024AE5]" />
                <h3 className="font-bold text-sm text-slate-900">Delivery & Site Destination</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Factory / Warehouse Shipping Address *
                  </Label>
                  <Textarea
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter complete delivery address with PIN code, landmark, and gate number..."
                    className="min-h-[85px] text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Client PO / Work Order # (Optional)
                    </Label>
                    <Input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-9812"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Delivery Instructions (Optional)
                    </Label>
                    <Input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Urgent dispatch via Blue Dart"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50 focus-visible:bg-white"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Order Summary & Placement */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-5 border border-slate-200 shadow-none bg-white rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#024AE5]" />
                  Order Summary ({items.length} SKUs)
                </h3>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
                {items.map((item) => (
                  <div key={item.variantId} className="pt-3 first:pt-0 flex justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{item.title}</p>
                      <p className="font-mono text-[11px] font-semibold text-[#024AE5] mt-0.5">
                        {item.sku}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Qty: <span className="font-bold text-slate-700">{item.quantity} units</span> × ₹{item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-900 shrink-0">
                      ₹{(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal (Excl. Tax)</span>
                  <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>GST (18% Integrated / CGST+SGST)</span>
                  <span className="font-mono font-medium">₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Shipping & Factory Handling</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                    To Be Billed / Freight Collect
                  </span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="font-mono text-lg text-[#024AE5]">
                    ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Place Order Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#024AE5] hover:bg-[#024AE5]/90 text-white font-bold text-sm h-11 shadow-none gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm & Place Order</span>
                  </>
                )}
              </Button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                By placing this order, you authorize Sojar Indusy Tech to process and allocate inventory as per B2B procurement terms.
              </p>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
