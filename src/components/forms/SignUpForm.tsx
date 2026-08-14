"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { INDIAN_STATES, TITLES } from "@/data/states";
import {
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
        setSuccess(res.message || "Account created successfully!");
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
      <Card className="border border-slate-200 bg-white shadow-xl rounded-2xl">
        <CardHeader className="bg-white p-6 pb-2 border-0">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Sign Up
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8 p-6 pt-4 bg-white">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Registration Error</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 rounded-lg border border-[#3C8B4F]/30 bg-[#3C8B4F]/10 p-4 text-sm text-[#3C8B4F]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3C8B4F]" />
                <div>
                  <p className="font-semibold">Success!</p>
                  <p className="text-xs mt-0.5">{success} Redirecting to login...</p>
                </div>
              </div>
            )}

            {/* SECTION 1: Personal & Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#024AE5]">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  1. Contact Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Title (shadcn Select) */}
                <div className="sm:col-span-3 space-y-1.5">
                  <Label>Title *</Label>
                  <Select
                    value={formData.title}
                    onValueChange={(val) => handleSelectChange("title", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Title" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* First Name */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="First Name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Last Name */}
                <div className="sm:col-span-5 space-y-1.5">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="Last Name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Department */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    name="department"
                    placeholder="e.g. Procurement"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Designation */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    name="designation"
                    placeholder="e.g. Purchase Manager"
                    value={formData.designation}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Mobile */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    placeholder="10-digit mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    required
                  />
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
                    placeholder="Landline number"
                    value={formData.landline}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Official Email */}
                <div className="sm:col-span-12 space-y-1.5">
                  <Label htmlFor="email">Official Email ID *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
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
                    onChange={handleInputChange}
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
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Company Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-[#3C8B4F]">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  2. Company Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Company Name */}
                <div className="sm:col-span-8 space-y-1.5">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    placeholder="Company Name"
                    value={formData.company_name}
                    onChange={handleInputChange}
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
                    placeholder="GSTIN Number"
                    value={formData.gstin}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Company Address */}
                <div className="sm:col-span-12 space-y-1.5">
                  <Label htmlFor="company_address">Company Address *</Label>
                  <Input
                    id="company_address"
                    name="company_address"
                    placeholder="Plot / Street / Area"
                    value={formData.company_address}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Additional Address (Optional) */}
                <div className="sm:col-span-12 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="additional_address">Additional Address</Label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <Input
                    id="additional_address"
                    name="additional_address"
                    placeholder="Building / Floor / Unit"
                    value={formData.additional_address}
                    onChange={handleInputChange}
                  />
                </div>

                {/* City */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* State Dropdown (shadcn Select) */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label>State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(val) => handleSelectChange("state", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pincode */}
                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    placeholder="Pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 pt-2 border-0">
            <p className="text-xs text-slate-500">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-[#024AE5] hover:underline">
                Sign In
              </Link>
            </p>
            <Button
              type="submit"
              size="lg"
              variant="primary"
              disabled={loading}
              className="w-full sm:w-auto gap-2"
            >
              {loading ? (
                "Creating Account..."
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
