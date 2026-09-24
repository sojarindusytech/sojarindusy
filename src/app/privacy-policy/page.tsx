import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Mail, Phone, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Sojar Solutions",
  description:
    "Learn how Sojar Solutions collects, protects, and handles your personal and commercial data when using our website and contacting our engineering team.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 21, 2026";

  return (
    <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-20 text-slate-800">
      <div className="container mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Back Link */}
        <div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#024AE5] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Contact</span>
          </Link>
        </div>

        {/* Header */}
        <div className="space-y-4 border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#024AE5] text-xs font-bold font-skoda uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy & Data Protection</span>
          </div>
          <h1 className="font-skoda text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-subheading">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-10 text-sm sm:text-base leading-relaxed text-slate-700 font-subheading">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              1. Introduction & Overview
            </h2>
            <p>
              Welcome to <strong>Sojar Solutions</strong> (“we”, “our”, or “us”). We respect your privacy and are committed to protecting any personal and commercial information you share with us. This Privacy Policy explains our practices regarding the collection, storage, use, and disclosure of information when you browse our website, submit inquiries, request quotations, or communicate with our engineering and sales representatives.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              2. Information We Collect
            </h2>
            <p>
              When you interact with our storefront or contact us, we may collect the following categories of information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>
                <strong>Contact Information:</strong> Full name, corporate email address, telephone / mobile number, company name, and geographical location.
              </li>
              <li>
                <strong>Inquiry & Tooling Details:</strong> Technical drawings, tooling specifications, quantities, custom application requirements, and messages provided through our contact forms or RFQ portals.
              </li>
              <li>
                <strong>Technical & Usage Data:</strong> IP address, browser type, device information, and pages visited to help us maintain website stability and security.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              3. How We Use Your Information
            </h2>
            <p>
              We use your submitted details exclusively for legitimate commercial, operational, and customer support purposes, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>Responding to your contact inquiries, quote requests, and technical queries.</li>
              <li>Coordinating with our tooling engineers to prepare formal commercial quotations and manufacturing lead times.</li>
              <li>Communicating status updates, shipment dispatch details, and order tracking information.</li>
              <li>Preventing spam, automated abuse, and maintaining website infrastructure security.</li>
            </ul>
            <p className="font-semibold text-slate-800">
              We do not sell, rent, or trade your personal or commercial contact information to third-party advertisers or data brokers under any circumstances.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              4. Data Protection & Security
            </h2>
            <p>
              We implement industry-standard administrative, physical, and technical safeguards (including encrypted database storage, secure SSL/TLS transmission, and strict role-based access control) to safeguard your data against unauthorized access, loss, or misuse.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              5. Your Rights & Data Retention
            </h2>
            <p>
              You have the right to request access to the personal data we hold about you, request corrections to inaccurate records, or ask us to delete your contact submission from our database. To exercise any of these rights, please contact our administrative desk using the details below.
            </p>
          </section>

          {/* Section 6: Contact Us */}
          <section className="space-y-4 pt-6 border-t border-slate-200">
            <h2 className="font-skoda text-xl sm:text-2xl font-bold text-slate-900">
              6. Contact Us Regarding Your Privacy
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data handling practices, please feel free to reach out to us directly:
            </p>

            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-slate-200 space-y-3 text-sm">
              <p className="font-bold text-slate-900 font-skoda text-base">Sojar Solutions</p>
              <div className="flex items-center gap-2.5 text-slate-600">
                <MapPin className="w-4 h-4 text-[#024AE5] shrink-0" />
                <span>Plot No. 7, Behind Hotel La Carta, Near Silvassa Road lines, N.H. No. 8, GIDC Char Rasta, Vapi, Valsad-396191, Gujarat, India</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <Phone className="w-4 h-4 text-[#024AE5] shrink-0" />
                <a href="tel:+919820701219" className="hover:text-[#024AE5]">+91-98207 01219</a> / <a href="tel:+919879337908" className="hover:text-[#024AE5]">+91-98793 37908</a>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <Mail className="w-4 h-4 text-[#024AE5] shrink-0" />
                <a href="mailto:sojarindusy@gmail.com" className="hover:text-[#024AE5] font-semibold">sojarindusy@gmail.com</a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
