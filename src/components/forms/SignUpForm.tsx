"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_STATES, TITLES } from "@/data/states";
import {
  User,
  Building2,
  Lock,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    role: "customer",
    title: "Mr",
    first_name: "",
    last_name: "",
    department: "",
    designation: "",
    mobile: "",
    landline: "",
    email: "",
    password: "",
    confirm_password: "",
    company_name: "",
    company_address: "",
    additional_address: "",
    gstin: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        data.append(key, val);
      });

      const res = await signUpUser(data);

      if (res.error) {
        setError(res.error);
      } else if (res.success) {
        setSuccess(res.message || "Account registered successfully!");
        setTimeout(() => {
          router.push("/login?registered=true");
        }, 2000);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during signup."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6">
      <Card className="border-slate-200/80 shadow-2xl dark:border-slate-800 backdrop-blur-xl">
        <CardHeader className="space-y-2 border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                B2B Client & Platform Registration
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                Register your business account for streamlined industrial orders and catalog access.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Account Type:</span>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400"
              >
                <option value="customer">B2B Customer / Buyer</option>
                <option value="platform_owner">Platform Owner (Admin)</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8 p-6 sm:p-8">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Registration Error</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">Success!</p>
                  <p className="text-xs mt-0.5">{success} Redirecting to login...</p>
                </div>
              </div>
            )}

            {/* SECTION 1: Personal & Official Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  1. Personal & Contact Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Title */}
                <div className="sm:col-span-3 space-y-1.5">
                  <Label htmlFor="title">Title *</Label>
                  <Select
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* First Name */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="e.g. Rajesh"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Last Name */}
                <div className="sm:col-span-5 space-y-1.5">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="e.g. Sharma"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Department */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="department">Department *</Label>
                  <div className="relative">
                    <Input
                      id="department"
                      name="department"
                      placeholder="e.g. Procurement / Maintenance"
                      value={formData.department}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                {/* Designation */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    name="designation"
                    placeholder="e.g. Senior Purchase Manager"
                    value={formData.designation}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Mobile */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="mobile">Mobile Number *</Label>
                  <div className="relative">
                    <Input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.mobile}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                {/* Landline No (Optional) */}
                <div className="sm:col-span-6 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="landline">Landline No.</Label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <Input
                    id="landline"
                    name="landline"
                    type="tel"
                    placeholder="e.g. 022-28471234"
                    value={formData.landline}
                    onChange={handleChange}
                  />
                </div>

                {/* Official Email */}
                <div className="sm:col-span-12 space-y-1.5">
                  <Label htmlFor="email">Official Email ID *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="e.g. rajesh@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Confirm Password */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="confirm_password">Confirm Password *</Label>
                  <Input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    placeholder="Re-enter password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Company Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  2. Company & Location Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Company Name */}
                <div className="sm:col-span-8 space-y-1.5">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    placeholder="e.g. Apex Precision Engineering Pvt Ltd"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* GSTIN (Optional) */}
                <div className="sm:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gstin">GSTIN</Label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <Input
                    id="gstin"
                    name="gstin"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={handleChange}
                  />
                </div>

                {/* Company Address */}
                <div className="sm:col-span-12 space-y-1.5">
                  <Label htmlFor="company_address">Company Address *</Label>
                  <Input
                    id="company_address"
                    name="company_address"
                    placeholder="Plot No, Industrial Estate, Main Road"
                    value={formData.company_address}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Additional Address (Optional) */}
                <div className="sm:col-span-12 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="additional_address">Additional Address / Unit No.</Label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <Input
                    id="additional_address"
                    name="additional_address"
                    placeholder="Floor, Block, Warehouse Number"
                    value={formData.additional_address}
                    onChange={handleChange}
                  />
                </div>

                {/* City */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="e.g. Pune"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* State Dropdown */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="state">State *</Label>
                  <Select
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Pincode */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    placeholder="e.g. 411001"
                    value={formData.pincode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Log In here
              </Link>
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
            >
              {loading ? (
                "Creating Business Account..."
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
