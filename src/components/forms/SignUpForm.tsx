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
  step1Schema,
  step2Schema,
  type Step1FormData,
  type Step2FormData,
} from "@/lib/validations/auth";
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    role: "customer",
    title: "Mr" as "Mr" | "Mrs" | "Miss" | "Ms",
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
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const step1Data: Step1FormData = {
      title: formData.title,
      first_name: formData.first_name,
      last_name: formData.last_name,
      department: formData.department,
      designation: formData.designation,
      mobile: formData.mobile,
      landline: formData.landline || undefined,
      email: formData.email,
      password: formData.password,
      confirm_password: formData.confirm_password,
    };

    const result = step1Schema.safeParse(step1Data);

    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString();
        if (fieldName && !formattedErrors[fieldName]) {
          formattedErrors[fieldName] = issue.message;
        }
      });
      setFieldErrors(formattedErrors);
      setError(result.error.issues[0]?.message || "Please resolve the errors above.");
      return;
    }

    setStep(2);
  };

  const handlePrevStep = () => {
    setError(null);
    setFieldErrors({});
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const step2Data: Step2FormData = {
      company_name: formData.company_name,
      gstin: formData.gstin || undefined,
      company_address: formData.company_address,
      additional_address: formData.additional_address || undefined,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    };

    const result = step2Schema.safeParse(step2Data);

    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString();
        if (fieldName && !formattedErrors[fieldName]) {
          formattedErrors[fieldName] = issue.message;
        }
      });
      setFieldErrors(formattedErrors);
      setError(result.error.issues[0]?.message || "Please resolve the errors above.");
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

  // Live password validation checklist
  const passwordChecks = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    lower: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password),
  };

  return (
    <div className="w-full max-w-xl mx-auto py-2">
      <Card className="border border-slate-200 bg-white shadow-none rounded-2xl overflow-hidden">
        {/* Centered Sign Up Header */}
        <CardHeader className="bg-white p-6 pb-2 border-0 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Sign Up
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 pt-2 bg-white min-h-[440px] flex flex-col justify-start">
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
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                <div className="border-b border-slate-100 pb-2 mb-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    User Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Title */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Title *</Label>
                    <Select
                      value={formData.title}
                      onValueChange={(val) => handleSelectChange("title", val)}
                    >
                      <SelectTrigger className="px-2">
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
                  <div className="sm:col-span-5 space-y-1">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      className={fieldErrors.first_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.first_name && (
                      <p className="text-[11px] text-red-600">{fieldErrors.first_name}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="sm:col-span-5 space-y-1">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      className={fieldErrors.last_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.last_name && (
                      <p className="text-[11px] text-red-600">{fieldErrors.last_name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Department */}
                  <div className="space-y-1">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className={fieldErrors.department ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.department && (
                      <p className="text-[11px] text-red-600">{fieldErrors.department}</p>
                    )}
                  </div>

                  {/* Designation */}
                  <div className="space-y-1">
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      className={fieldErrors.designation ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.designation && (
                      <p className="text-[11px] text-red-600">{fieldErrors.designation}</p>
                    )}
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
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className={fieldErrors.mobile ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.mobile && (
                      <p className="text-[11px] text-red-600">{fieldErrors.mobile}</p>
                    )}
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
                      value={formData.landline}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Email (Kept placeholder) */}
                <div className="space-y-1">
                  <Label htmlFor="email">Official Email ID *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={fieldErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-[11px] text-red-600">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Password with View Toggle */}
                  <div className="space-y-1">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`pr-10 ${fieldErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer focus:outline-none z-10"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[11px] text-red-600">{fieldErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password with View Toggle */}
                  <div className="space-y-1">
                    <Label htmlFor="confirm_password">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirm_password}
                        onChange={handleInputChange}
                        className={`pr-10 ${fieldErrors.confirm_password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer focus:outline-none z-10"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirm_password && (
                      <p className="text-[11px] text-red-600">{fieldErrors.confirm_password}</p>
                    )}
                  </div>
                </div>

                {/* Password Criteria Helper */}
                {formData.password.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1 text-[11px]">
                    <p className="font-semibold text-slate-700 text-[11px] mb-1">
                      Password Requirements:
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <span className={passwordChecks.length ? "text-[#3C8B4F] font-medium" : "text-slate-400"}>
                        {passwordChecks.length ? "✓" : "•"} Min 8 characters
                      </span>
                      <span className={passwordChecks.upper ? "text-[#3C8B4F] font-medium" : "text-slate-400"}>
                        {passwordChecks.upper ? "✓" : "•"} 1 Uppercase (A-Z)
                      </span>
                      <span className={passwordChecks.lower ? "text-[#3C8B4F] font-medium" : "text-slate-400"}>
                        {passwordChecks.lower ? "✓" : "•"} 1 Lowercase (a-z)
                      </span>
                      <span className={passwordChecks.number ? "text-[#3C8B4F] font-medium" : "text-slate-400"}>
                        {passwordChecks.number ? "✓" : "•"} 1 Number (0-9)
                      </span>
                      <span className={passwordChecks.special ? "text-[#3C8B4F] font-medium" : "text-slate-400"}>
                        {passwordChecks.special ? "✓" : "•"} 1 Special char (@#$%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Company Details Heading & Form */}
            {step === 2 && (
              <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                <div className="border-b border-slate-100 pb-2 mb-2">
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
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className={fieldErrors.company_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                    required
                  />
                  {fieldErrors.company_name && (
                    <p className="text-[11px] text-red-600">{fieldErrors.company_name}</p>
                  )}
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
                    value={formData.gstin}
                    onChange={handleInputChange}
                    className={fieldErrors.gstin ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {fieldErrors.gstin && (
                    <p className="text-[11px] text-red-600">{fieldErrors.gstin}</p>
                  )}
                </div>

                {/* Company Address */}
                <div className="space-y-1">
                  <Label htmlFor="company_address">Company Address *</Label>
                  <Input
                    id="company_address"
                    name="company_address"
                    value={formData.company_address}
                    onChange={handleInputChange}
                    className={fieldErrors.company_address ? "border-red-500 focus-visible:ring-red-500" : ""}
                    required
                  />
                  {fieldErrors.company_address && (
                    <p className="text-[11px] text-red-600">{fieldErrors.company_address}</p>
                  )}
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
                      value={formData.city}
                      onChange={handleInputChange}
                      className={fieldErrors.city ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.city && (
                      <p className="text-[11px] text-red-600">{fieldErrors.city}</p>
                    )}
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
                      value={formData.pincode}
                      onChange={handleInputChange}
                      className={fieldErrors.pincode ? "border-red-500 focus-visible:ring-red-500" : ""}
                      required
                    />
                    {fieldErrors.pincode && (
                      <p className="text-[11px] text-red-600">{fieldErrors.pincode}</p>
                    )}
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
