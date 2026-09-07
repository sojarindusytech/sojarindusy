"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface HeroSlide {
  id: string;
  image: string;
  alt: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: "slide-1",
    image: "/assets/hero/hero.png",
    alt: "Industrial CNC Machining and Precision Tooling",
    title: "Sojar makes it possible.",
    subtitle: "We engineer high-performance tooling solutions for modern manufacturing",
    ctaText: "View Catalog",
    ctaLink: "/products",
  },
];

export function HeroSlider() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slide = SLIDES[currentSlideIndex];

  return (
    <section className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-4 pb-12">
      <div className="relative w-full overflow-hidden rounded-xs sm:rounded-sm border border-slate-200/80 shadow-xs bg-slate-950">
        {/* Main Hero Image */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] min-h-[320px] max-h-[540px]">
          <Image
            src={slide.image}
            alt={slide.alt}
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        {/* Bottom Dark Banner Overlay matching Sandvik Reference */}
        <div className="w-full bg-[#3a3d40] px-5 py-4 sm:px-8 sm:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
              {slide.subtitle}
            </p>
          </div>

          <div className="shrink-0">
            <Link href={slide.ctaLink}>
              <Button className="bg-[#024AE5] hover:bg-[#0238B0] text-white font-medium text-xs sm:text-sm px-6 py-2.5 h-auto rounded-none shadow-none transition-colors cursor-pointer inline-flex items-center gap-2">
                <span>{slide.ctaText}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
