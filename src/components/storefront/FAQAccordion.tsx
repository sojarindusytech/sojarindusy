"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const defaultFAQs: FAQItem[] = [
  {
    id: "tooling-solutions",
    question: "WHAT TOOLING SOLUTIONS AND PRODUCTS DOES SOJAR SOLUTIONS OFFER?",
    answer:
      "We provide precision tooling solutions, including solid carbide end mills, ball nose cutters, drills, inserts, oscillating blades, and other high-performance cutting tools.",
  },
  {
    id: "customized-solutions",
    question: "DO YOU PROVIDE CUSTOMIZED TOOLING SOLUTIONS?",
    answer:
      "Yes. We design and manufacture customized tooling solutions and carbide wear parts tailored to specific applications.",
  },
  {
    id: "industries-served",
    question: "WHAT INDUSTRIES DO YOU SERVE?",
    answer:
      "Our products are used in automotive, medical devices, die & mould, oil & gas, power generation, and general engineering.",
  },
  {
    id: "product-quality",
    question: "HOW DO YOU ENSURE PRODUCT QUALITY?",
    answer:
      "All products undergo strict testing, from certified raw material sourcing to final inspection, ensuring durability and precision.",
  },
  {
    id: "technical-support",
    question: "DO YOU PROVIDE TECHNICAL SUPPORT?",
    answer:
      "Yes. Our team helps clients choose the right tooling solutions and carbide grades for optimal performance.",
  },
  {
    id: "inquire-products",
    question: "HOW CAN I INQUIRE ABOUT YOUR PRODUCTS AND SERVICES?",
    answer:
      "You can reach us via our website, email, or phone. Our team will assist you with tailored solutions.",
  },
  {
    id: "business-hours",
    question: "WHAT ARE YOUR BUSINESS HOURS?",
    answer:
      "Monday to Saturday, 9:00 AM to 6:00 PM (IST). Closed on Sundays and public holidays.",
  },
];

interface FAQAccordionProps {
  items?: FAQItem[];
  title?: string;
}

export function FAQAccordion({
  items = defaultFAQs,
  title = "Frequently Asked Questions",
}: FAQAccordionProps) {
  // Allow toggling multiple or single item (default first open or closed)
  const [openIds, setOpenIds] = useState<string[]>(["tooling-solutions"]);

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5">
      {title && (
        <h2 className="font-skoda text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 text-center mb-8 lg:mb-10 tracking-tight">
          {title}
        </h2>
      )}

      <div className="space-y-3.5 sm:space-y-4">
        {items.map((item) => {
          const isOpen = openIds.includes(item.id);

          return (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden border border-blue-100 shadow-[0_2px_8px_rgba(2,74,229,0.04)] transition-all duration-200"
            >
              {/* Question Header */}
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-4.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-slate-900 text-left transition-colors cursor-pointer select-none"
                aria-expanded={isOpen}
              >
                <span className="font-skoda text-xs sm:text-sm md:text-[0.95rem] font-bold tracking-wide uppercase pr-4 text-slate-900">
                  {item.question}
                </span>

                <span className="shrink-0 flex items-center justify-center text-[#024AE5]">
                  {isOpen ? (
                    <Minus className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  )}
                </span>
              </button>

              {/* Collapsible Answer */}
              {isOpen && (
                <div className="bg-white px-5 sm:px-6 py-5 sm:py-6 border-t border-blue-100/80 animate-in fade-in-50 duration-150">
                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-subheading">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
