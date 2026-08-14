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
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import Link from "next/link";

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
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

  const validateStep1 = () => {
    if (!formData.first_name.trim()) return "First name is required.";
    if (!formData.last_name.trim()) return "Last name is required.";
    if (!formData.department.trim()) return "Department is required.";
    if (!formData.designation.trim()) return "Designation is required.";
    if (!formData.mobile.trim()) return "Mobile number is required.";
    if (!formData.email.trim()) return "Official email is required.";
    if (!formData.password) return "Password is required.";
    if (formData.password.length < 6) return "Password must be at least 6 characters.";
    if (formData.password !== formData.confirm_password) return "Passwords do not match.";
    return null;
  };

  const validateStep2 = () => {
    if (!formData.company_name.trim()) return "Company name is required.";
    if (!formData.company_address.trim()) return "Company address is required.";
    if (!formData.city.trim()) return "City is required.";
    if (!formData.state.trim()) return "State is required.";
    if (!formData.pincode.trim()) return "Pincode is required.";
    return null;
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    const step1Error = validateStep1();
    if (step1Error) {
      setError(step1Error);
      return;
    }
    setStep(2);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const step2Error = validateStep2();
    if (step2Error) {
      setError(step2Error);
      return;
    }

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
        }, 1500);
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
    <div className="w-full max-w-xl mx-auto py-2">
      <Card className="border border-slate-200 bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Centered Sign Up Header */}
        <CardHeader className="bg-white p-6 pb-2 border-0 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Sign Up
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 pt-2 bg-white min-h-[420px] flex flex-col justify-start">
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#3C8B4F]/30 bg-[#3C8B4F]/10 p-3 text-xs text-[#3C8B4F]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3C8B4F] mt-0.5" />
                <p>{success} Redirecting to login...</p>
              </div>
            )}

            {/* STEP 1: User Details Heading & Form */}
            {step === 1 && (
              <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    User Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Title */}
                  <div className="sm:col-span-3 space-y-1">
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
                  <div className="sm:col-span-4 space-y-1">
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
                  <div className="sm:col-span-5 space-y-1">
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Department */}
                  <div className="space-y-1">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      name="department"
                      placeholder="Department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Designation */}
                  <div className="space-y-1">
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      name="designation"
                      placeholder="Designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mobile */}
                  <div className="space-y-1">
                    <Label htmlFor="mobile">Mobile *</Label>
                    <Input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      placeholder="Mobile number"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Landline */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="landline">Landline</Label>
                      <span className="text-[10px] text-slate-400">Optional</span>
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
                </div>

                {/* Email */}
                <div className="space-y-1">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Password */}
                  <div className="space-y-1">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
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
            )}

            {/* STEP 2: Company Details Heading & Form */}
            {step === 2 && (
              <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Company Details
                  </h2>
                </div>

                {/* Company Name */}
                <div className="space-y-1">
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

                {/* GSTIN */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gstin">GSTIN</Label>
                    <span className="text-[10px] text-slate-400">Optional</span>
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
                <div className="space-y-1">
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

                {/* Additional Address */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="additional_address">Additional Address</Label>
                    <span className="text-[10px] text-slate-400">Optional</span>
                  </div>
                  <Input
                    id="additional_address"
                    name="additional_address"
                    placeholder="Building / Floor / Unit"
                    value={formData.additional_address}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* City */}
                  <div className="space-y-1">
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

                  {/* State */}
                  <div className="space-y-1">
                    <Label>State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(val) => handleSelectChange("state", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
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
                  <div className="space-y-1">
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
            )}
          </CardContent>

          {/* Footer Controls */}
          <CardFooter className="flex items-center justify-between gap-3 bg-white p-6 pt-3 border-t border-slate-100">
            {step === 1 ? (
              <>
                <p className="text-xs text-slate-500">
                  Already registered?{" "}
                  <Link href="/login" className="font-semibold text-[#024AE5] hover:underline">
                    Sign In
                  </Link>
                </p>
                <Button
                  type="button"
                  size="default"
                  variant="primary"
                  onClick={handleNextStep}
                  className="gap-2 px-5"
                >
                  <span>Next: Company Details</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Button>

                <Button
                  type="submit"
                  size="default"
                  variant="primary"
                  disabled={loading}
                  className="gap-2 px-6"
                >
                  {loading ? (
                    "Creating Account..."
                  ) : (
                    <>
                      <span>Create Account</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
