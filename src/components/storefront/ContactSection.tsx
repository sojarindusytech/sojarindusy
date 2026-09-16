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

interface FormErrors {
  fullName?: string;
  email?: string;
  mobile?: string;
  message?: string;
  captcha?: string;
}

export function ContactSection() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");

  // Validation & UI State
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (rawDigits.length === 12 && rawDigits.startsWith("91")) {
          return undefined;
        }
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
      // Allow only digits, plus, hyphens, and spaces
      const filtered = value.replace(/[^0-9+\s-]/g, "");
      setMobile(filtered);
    } else if (field === "message") setMessage(value);
    else if (field === "captcha") {
      setCaptchaInput(value);
      setIsVerified(false);
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
    });

    // Validate all fields
    const nameErr = validateField("fullName", fullName);
    const emailErr = validateField("email", email);
    const mobileErr = validateField("mobile", mobile);
    const msgErr = validateField("message", message);

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
    };

    setErrors(currentErrors);

    if (nameErr || emailErr || mobileErr || msgErr || captchaErr || !verifiedNow) {
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
      });

      if (res.success) {
        toast.success(
          "Thank you! Your inquiry has been sent successfully. Our team will contact you soon."
        );
        // Reset form
        setFullName("");
        setEmail("");
        setMobile("");
        setMessage("");
        setCaptchaInput("");
        setIsVerified(false);
        setTouched({});
        setErrors({});
        generateNewChallenge();
      } else {
        toast.error(res.error || "Failed to submit your message. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
                  placeholder="Enter Your Mobile No (10 digits)"
                  maxLength={15}
                  value={mobile}
                  onChange={(e) => handleChange("mobile", e.target.value)}
                  onBlur={() => handleBlur("mobile")}
                  className="w-full text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
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

            {/* Send Message Button in Brand Blue */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#024AE5] hover:bg-[#013BB8] text-white font-bold text-sm tracking-wide rounded-sm shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-70 cursor-pointer font-skoda"
              >
                <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                <Send className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          </form>
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

              <div className="flex items-center gap-3">
                {/* Facebook */}
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-[#1877F2] hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-[#E4405F] hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-[#0A66C2] hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/919820701219"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-[#25D366] hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </a>
              </div>
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

        {/* Responsive Map Container */}
        <div className="w-full h-[380px] sm:h-[450px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative">
          <iframe
            title="Sojar Indusy Location Map"
            src="https://maps.google.com/maps?cid=2849366181503425652&output=embed"
            className="w-full h-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
