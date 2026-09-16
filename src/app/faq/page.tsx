import React from "react";
import type { Metadata } from "next";
import { FAQAccordion } from "@/components/storefront/FAQAccordion";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Sojar Indusy",
  description:
    "Find answers to frequently asked questions regarding Sojar Indusy's precision tooling solutions, custom carbide components, quality assurance, and technical support.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <FAQAccordion />
      </div>
    </div>
  );
}
