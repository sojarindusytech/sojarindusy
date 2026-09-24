"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  Headphones,
  Mail,
  CheckCircle2,
  ExternalLink,
  Send,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { submitContactInquiry } from "@/actions/contact";
import { SocialLinks } from "@/components/common/SocialLinks";

interface FormErrors {
  fullName?: string;
  email?: string;
  mobile?: string;
  message?: string;
  captcha?: string;
  privacy?: string;
}

export function ContactSection() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  // Validation & UI State
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Human verification math challenge
  const [num1, setNum1] = useState(80);
  const [num2, setNum2] = useState(3);
  const [captchaInput, setCaptchaInput] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // Generate random simple math verification on mount
  useEffect(() => {
    generateNewChallenge();
  }, []);

  const generateNewChallenge = () => {
    const n1 = Math.floor(Math.random() * 40) + 10;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setCaptchaInput("");
    setIsVerified(false);
  };

  const handleSendAnotherMessage = () => {
    setIsSubmitted(false);
    setFullName("");
    setEmail("");
    setMobile("");
    setMessage("");
    setCaptchaInput("");
    setIsVerified(false);
    setPrivacyAgreed(false);
    setTouched({});
    setErrors({});
    generateNewChallenge();
  };

  // Field validator function
  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "fullName": {
        const trimmed = value.trim();
        if (!trimmed) return "Full name is required.";
        if (trimmed.length < 2) return "Name must be at least 2 characters long.";
        if (trimmed.length > 100) return "Name cannot exceed 100 characters.";
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
          return "Name should only contain letters and standard punctuation.";
        }
        return undefined;
      }
      case "email": {
        const trimmed = value.trim();
        if (!trimmed) return "Email address is required.";
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(trimmed)) {
          return "Please enter a valid email address (e.g. name@company.com).";
        }
        return undefined;
      }
      case "mobile": {
        const trimmed = value.trim();
        if (!trimmed) return undefined; // Optional field
        const rawDigits = trimmed.replace(/\D/g, "");
        if (rawDigits.length !== 10) {
          return "Please enter a valid 10-digit mobile number.";
        }
        if (!/^[6-9]/.test(rawDigits)) {
          return "Mobile number should typically start with 6, 7, 8, or 9.";
        }
        return undefined;
      }
      case "message": {
        const trimmed = value.trim();
        if (!trimmed) return "Message is required.";
        if (trimmed.length < 10) {
          return `Please enter at least 10 characters (${10 - trimmed.length} more needed).`;
        }
        if (trimmed.length > 2000) {
          return "Message cannot exceed 2000 characters.";
        }
        return undefined;
      }
      case "captcha": {
        if (isVerified) return undefined;
        const ans = parseInt(value.trim(), 10);
        if (isNaN(ans)) {
          return "Please solve the math verification.";
        }
        if (ans !== num1 + num2) {
          return `Incorrect answer (${num1} + ${num2} = ?). Try again.`;
        }
        return undefined;
      }
      case "privacy": {
        if (!privacyAgreed) {
          return "You must agree to our Privacy Policy to submit your message.";
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let val = "";
    if (field === "fullName") val = fullName;
    else if (field === "email") val = email;
    else if (field === "mobile") val = mobile;
    else if (field === "message") val = message;
    else if (field === "captcha") val = captchaInput;

    const err = validateField(field, val);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleChange = (field: string, value: string) => {
    if (field === "fullName") setFullName(value);
    else if (field === "email") setEmail(value);
    else if (field === "mobile") {
      // Strictly numeric digits only, maximum 10 digits
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setMobile(digitsOnly);
    } else if (field === "message") setMessage(value);
    else if (field === "captcha") {
      setCaptchaInput(value);
      if (parseInt(value.trim(), 10) === num1 + num2) {
        setIsVerified(true);
        setErrors((prev) => ({ ...prev, captcha: undefined }));
      } else {
        setIsVerified(false);
      }
    }

    // Clear error dynamically if user fixes it
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleVerify = () => {
    const ans = parseInt(captchaInput.trim(), 10);
    if (ans === num1 + num2) {
      setIsVerified(true);
      setErrors((prev) => ({ ...prev, captcha: undefined }));
      toast.success("Human verification successful!");
    } else {
      setIsVerified(false);
      setErrors((prev) => ({
        ...prev,
        captcha: `Incorrect answer. ${num1} + ${num2} = ?`,
      }));
      toast.error("Incorrect answer. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all as touched
    setTouched({
      fullName: true,
      email: true,
      mobile: true,
      message: true,
      captcha: true,
      privacy: true,
    });

    // Validate all fields
    const nameErr = validateField("fullName", fullName);
    const emailErr = validateField("email", email);
    const mobileErr = validateField("mobile", mobile);
    const msgErr = validateField("message", message);
    const privacyErr = !privacyAgreed
      ? "You must agree to our Privacy Policy to submit your message."
      : undefined;

    // Auto-verify if the user typed the right answer without clicking "Verify" first
    let captchaErr: string | undefined = undefined;
    let verifiedNow = isVerified;

    if (!isVerified) {
      const ans = parseInt(captchaInput.trim(), 10);
      if (ans === num1 + num2) {
        setIsVerified(true);
        verifiedNow = true;
      } else {
        captchaErr = validateField("captcha", captchaInput);
      }
    }

    const currentErrors: FormErrors = {
      fullName: nameErr,
      email: emailErr,
      mobile: mobileErr,
      message: msgErr,
      captcha: captchaErr,
      privacy: privacyErr,
    };

    setErrors(currentErrors);

    if (nameErr || emailErr || mobileErr || msgErr || captchaErr || privacyErr || !verifiedNow) {
      toast.error("Please correct the highlighted errors before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitContactInquiry({
        fullName,
        email,
        mobile,
        message,
        privacyAccepted: privacyAgreed,
      });

      if (res.success) {
        toast.success(
          "Thank you! Your inquiry has been sent successfully."
        );
        setIsSubmitted(true);
      } else {
        toast.error(res.error || "Failed to submit your message. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validity checks for all required details to control submit button state
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  const trimmedMsg = message.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isNameValid = trimmedName.length >= 2 && trimmedName.length <= 100 && /^[a-zA-Z\s.'-]+$/.test(trimmedName);
  const isEmailValid = emailRegex.test(trimmedEmail) && trimmedEmail.length <= 254;
  const isMessageValid = trimmedMsg.length >= 10 && trimmedMsg.length <= 2000;
  const isCaptchaValid = isVerified || (parseInt(captchaInput.trim(), 10) === (num1 + num2));
  const isMobileValid = mobile.length === 0 || (mobile.length === 10 && /^[6-9]/.test(mobile));

  const isFormReady =
    isNameValid &&
    isEmailValid &&
    isMessageValid &&
    isCaptchaValid &&
    isMobileValid &&
    privacyAgreed;

  const getMissingRequirementsHint = () => {
    if (isFormReady) return null;
    const missing: string[] = [];
    if (!isNameValid) missing.push("Full Name");
    if (!isEmailValid) missing.push("Valid E-mail");
    if (mobile.length > 0 && !isMobileValid) missing.push("10-digit Mobile (starts with 6-9)");
    if (!isMessageValid) missing.push("Message (min 10 characters)");
    if (!isCaptchaValid) missing.push("Human Verification");
    if (!privacyAgreed) missing.push("Privacy Policy Checkbox");

    return `Required to send: ${missing.join(", ")}`;
  };

  const googleMapsUrl =
    "https://maps.google.com/?cid=2849366181503425652&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAMYASAFKgSoqNcy";

  return (
    <div className="w-full space-y-16">
      {/* Top Two-Column Contact Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Form: Connect With Us */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h2 className="font-skoda text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Connect With Us
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Have questions or need a quotation? Fill out the form below and our engineering team will get back to you promptly.
            </p>
          </div>

          {/* Success State View */}
          {isSubmitted ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 p-8 sm:p-12 shadow-sm text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200/80 shadow-xs">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div className="space-y-2.5 max-w-lg mx-auto">
                <h3 className="font-skoda text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Your message was sent!
                </h3>
                <p className="text-sm sm:text-base text-slate-600 font-subheading leading-relaxed">
                  Thank you for reaching out to Sojar Solutions. Our technical and commercial engineering team will review your inquiry and get back to you within 24 hours.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendAnotherMessage}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#024AE5] hover:bg-[#013BB8] text-white font-bold text-sm tracking-wide rounded-sm shadow-sm transition-all duration-150 active:scale-95 cursor-pointer font-skoda"
                >
                  <Send className="w-4 h-4" />
                  <span>Send a New Message</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Full Name */}
              <div>
                <input
                  type="text"
                  placeholder="Full Name*"
                  value={fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  className={`w-full border-b py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors bg-transparent ${
                    touched.fullName && errors.fullName
                      ? "border-red-500 focus:border-red-600"
                      : "border-slate-300 focus:border-[#024AE5]"
                  }`}
                />
                {touched.fullName && errors.fullName && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.fullName}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <input
                  type="email"
                  placeholder="Your E-mail*"
                  value={email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  className={`w-full border-b py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors bg-transparent ${
                    touched.email && errors.email
                      ? "border-red-500 focus:border-red-600"
                      : "border-slate-300 focus:border-[#024AE5]"
                  }`}
                />
                {touched.email && errors.email && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Mobile Number with India Flag */}
              <div>
                <div
                  className={`flex items-center gap-3 border-b py-3 transition-colors ${
                    touched.mobile && errors.mobile
                      ? "border-red-500"
                      : "border-slate-300 focus-within:border-[#024AE5]"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-base select-none shrink-0" title="India (+91)">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">+91</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter Your Mobile No (10 digits)"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    onBlur={() => handleBlur("mobile")}
                    className="w-full text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                  />
                  {mobile.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono select-none shrink-0">
                      {mobile.length}/10
                    </span>
                  )}
                </div>
                {touched.mobile && errors.mobile && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.mobile}</span>
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <textarea
                  placeholder="Message* (min 10 characters)"
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  onBlur={() => handleBlur("message")}
                  className={`w-full border-b py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors bg-transparent resize-y min-h-[100px] ${
                    touched.message && errors.message
                      ? "border-red-500 focus:border-red-600"
                      : "border-slate-300 focus:border-[#024AE5]"
                  }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {touched.message && errors.message ? (
                    <p className="text-xs text-red-600 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.message}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-[11px] text-slate-400 font-mono select-none ml-auto">
                    {message.length} / 2000
                  </span>
                </div>
              </div>

              {/* Human Verification Box */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Human verification <span className="text-red-500">*</span>
                  </p>
                  <button
                    type="button"
                    onClick={generateNewChallenge}
                    className="text-xs text-[#024AE5] hover:underline cursor-pointer"
                  >
                    Change question
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-2 rounded border border-slate-200 select-none">
                    {num1} + {num2} =
                  </span>

                  <input
                    type="text"
                    placeholder="Answer"
                    disabled={isVerified}
                    value={captchaInput}
                    onChange={(e) => handleChange("captcha", e.target.value)}
                    onBlur={() => handleBlur("captcha")}
                    className={`w-24 sm:w-28 border rounded px-3 py-2 text-sm focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 ${
                      touched.captcha && errors.captcha
                        ? "border-red-500 focus:border-red-600"
                        : "border-slate-300 focus:border-[#024AE5]"
                    }`}
                  />

                  {!isVerified ? (
                    <button
                      type="button"
                      onClick={handleVerify}
                      className="px-4 py-2 bg-[#024AE5] hover:bg-[#013BB8] text-white font-bold text-xs rounded shadow-xs transition-colors cursor-pointer"
                    >
                      Verify
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      Verified
                    </span>
                  )}
                </div>

                {touched.captcha && errors.captcha && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.captcha}</span>
                  </p>
                )}
              </div>

              {/* Privacy Policy Agreement Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    id="privacyPolicyCheckbox"
                    checked={privacyAgreed}
                    onChange={(e) => {
                      setPrivacyAgreed(e.target.checked);
                      if (touched.privacy) {
                        setErrors((prev) => ({
                          ...prev,
                          privacy: e.target.checked
                            ? undefined
                            : "You must agree to our Privacy Policy to submit your message.",
                        }));
                      }
                    }}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-[#024AE5] focus:ring-[#024AE5] cursor-pointer accent-[#024AE5]"
                  />
                  <span className="text-xs sm:text-sm text-slate-600 leading-relaxed font-subheading">
                    You agree to our{" "}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#024AE5] hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>{" "}
                    and consent to having Sojar Solutions store and process your details to respond to your inquiry.{" "}
                    <span className="text-red-500 font-bold" title="Mandatory">*</span>
                  </span>
                </label>

                {touched.privacy && errors.privacy && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium animate-in fade-in-50 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.privacy}</span>
                  </p>
                )}
              </div>

              {/* Send Message Button in Brand Blue - Disabled until ALL required details are valid */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormReady}
                  title={!isFormReady ? getMissingRequirementsHint() || undefined : undefined}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#024AE5] hover:bg-[#013BB8] text-white font-bold text-sm tracking-wide rounded-sm shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer font-skoda"
                >
                  <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                  <Send className="w-4 h-4 stroke-[2]" />
                </button>
                {!isFormReady && (
                  <p className="text-[11.5px] text-slate-400 mt-2 font-subheading">
                    {getMissingRequirementsHint()}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Right Details: Contact Details */}
        <div className="lg:col-span-5 space-y-8 lg:pl-4">
          <h2 className="font-skoda text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Contact Details
          </h2>

          <div className="space-y-6 text-slate-800 text-sm sm:text-base font-subheading">
            {/* Address */}
            <div className="flex items-start gap-4">
              <div className="mt-0.5 shrink-0 p-2.5 rounded-full bg-blue-50 text-[#024AE5] flex items-center justify-center">
                <MapPin className="w-5 h-5 stroke-[2.2]" />
              </div>
              <p className="leading-relaxed text-slate-700 text-sm sm:text-base pt-0.5">
                Plot No. 7, Behind Hotel La Carta, Near Silvassa Road lines, N.H. No. 8,
                GIDC Char Rasta, Vapi, Valsad-396191, Gujarat, India
              </p>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-4">
              <div className="shrink-0 p-2.5 rounded-full bg-blue-50 text-[#024AE5] flex items-center justify-center">
                <Headphones className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-sm sm:text-base font-bold text-slate-900">
                <a
                  href="tel:+919820701219"
                  className="hover:text-[#024AE5] transition-colors"
                >
                  +91-98207 01219
                </a>
                <span className="text-slate-400 font-normal">,</span>
                <a
                  href="tel:+919879337908"
                  className="hover:text-[#024AE5] transition-colors"
                >
                  +91-98793 37908
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4">
              <div className="shrink-0 p-2.5 rounded-full bg-blue-50 text-[#024AE5] flex items-center justify-center">
                <Mail className="w-5 h-5 stroke-[2.2]" />
              </div>
              <a
                href="mailto:sojarindusy@gmail.com"
                className="font-bold text-slate-900 text-sm sm:text-base hover:text-[#024AE5] transition-colors"
              >
                sojarindusy@gmail.com
              </a>
            </div>

            {/* Social Follow Links */}
            <div className="pt-4 flex items-center gap-3">
              <span className="font-skoda font-bold text-base text-[#024AE5]">
                Follow on:
              </span>

              <SocialLinks variant="circle" />
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Google Map Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#024AE5]" />
            <span>Our Location on Google Maps</span>
          </h3>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#024AE5] hover:underline"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Responsive Map Container with Shimmer Skeleton */}
        <div className="w-full h-[380px] sm:h-[450px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative">
          {/* Animated Loading Skeleton (Disappears as soon as map streams in) */}
          {!isMapLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/95 space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100/80 text-[#024AE5] flex items-center justify-center shadow-xs">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs sm:text-sm font-bold text-slate-700 font-skoda">
                  Loading Sojar Solutions Map...
                </p>
                <p className="text-[11px] text-slate-400 font-subheading">
                  Plot No. 7, GIDC Char Rasta, Vapi, Gujarat
                </p>
              </div>
            </div>
          )}

          <iframe
            title="Sojar Solutions Location Map"
            src="https://maps.google.com/maps?q=Sojar+Indusy,+GIDC+Char+Rasta,+Vapi,+Gujarat&cid=2849366181503425652&t=m&z=15&output=embed&iwloc=near"
            onLoad={() => setIsMapLoaded(true)}
            className={`w-full h-full border-0 transition-opacity duration-700 ease-in-out ${
              isMapLoaded ? "opacity-100" : "opacity-0"
            }`}
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
