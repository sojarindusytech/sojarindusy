import React from "react";
import type { Metadata } from "next";
import { ContactSection } from "@/components/storefront/ContactSection";

export const metadata: Metadata = {
  title: "Contact Us | Sojar Solutions",
  description:
    "Get in touch with Sojar Solutions for precision carbide tooling, custom industrial wear parts, technical support, and partnership inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <ContactSection />
      </div>
    </div>
  );
}
