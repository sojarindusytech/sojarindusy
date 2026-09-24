"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  { desktop: "/assets/carousel/desktop/1.webp", mobile: "/assets/carousel/mobile/1.webp", alt: "Sojar Solutions – Slide 1" },
  { desktop: "/assets/carousel/desktop/2.webp", mobile: "/assets/carousel/mobile/2.webp", alt: "Sojar Solutions – Slide 2" },
  { desktop: "/assets/carousel/desktop/3.webp", mobile: "/assets/carousel/mobile/3.webp", alt: "Sojar Solutions – Slide 3" },
  { desktop: "/assets/carousel/desktop/4.webp", mobile: "/assets/carousel/mobile/4.webp", alt: "Sojar Solutions – Slide 4" },
];

const AUTOPLAY_MS = 4000;

export function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-play (4 seconds)
  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, next]);

  return (
    <section className="w-full">
      <div
        className="relative w-full overflow-hidden bg-white select-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Slides — 100% full width edge-to-edge with slightly reduced height */}
        <div className="relative w-full aspect-[2/1] sm:aspect-[22/9] lg:aspect-[23/9]">
          {SLIDES.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {/* Mobile image */}
              <Image
                src={slide.mobile}
                alt={slide.alt}
                fill
                className="object-cover object-center sm:hidden"
                priority={idx <= 1}
                loading={idx <= 1 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 100vw, 1px"
              />
              {/* Desktop image */}
              <Image
                src={slide.desktop}
                alt={slide.alt}
                fill
                className="object-cover object-center hidden sm:block"
                priority={idx <= 1}
                loading={idx <= 1 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 1px, (max-width: 1536px) 100vw, 1536px"
              />
            </div>
          ))}

          {/* Prev / Next arrows */}
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center transition-colors backdrop-blur-xs cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center transition-colors backdrop-blur-xs cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  idx === current
                    ? "bg-white w-5 h-2"
                    : "bg-white/50 hover:bg-white/75 w-2 h-2"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
