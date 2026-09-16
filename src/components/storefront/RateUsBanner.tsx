import React from "react";
import Image from "next/image";

export function RateUsBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-slate-950 py-12 sm:py-14 lg:py-16">
      {/* Background Industrial Image with Dark Blue / Industrial Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/hero/hero.png"
          alt="Precision Industrial Engineering"
          fill
          className="object-cover object-center opacity-25 mix-blend-luminosity scale-105"
        />
        {/* Deep Industrial Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071328]/95 via-[#091833]/90 to-[#071328]/95" />
      </div>

      <div className="container relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 lg:gap-10">
          {/* Left Text */}
          <h2 className="font-skoda text-white text-xl sm:text-2xl lg:text-[1.85rem] font-bold leading-snug sm:leading-snug max-w-3xl tracking-tight">
            Your Review Helps Us Engineer Better Solutions — Share Your Experience on Google!
          </h2>

          {/* Right Button */}
          <div className="shrink-0">
            <a
              href="https://share.google/qpX0a5sbocVKWHbQq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-2.5 sm:py-3 rounded-lg border border-[#14b8a6]/70 bg-[#0d4a52]/80 hover:bg-[#115e68] text-white font-medium text-sm sm:text-base transition-all duration-200 shadow-sm hover:shadow-md hover:border-[#14b8a6] active:scale-95 font-body"
            >
              Rate Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
