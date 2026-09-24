"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: "Rajesh Singhania",
    role: "VP – Tooling & Production",
    company: "Bharat Precision Forgings, Pune",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    quote:
      "Switching to Sojar Solutions solid carbide end mills reduced our cycle times by 24% while drastically extending tool lifespan. Their precision engineering and on-time delivery across Maharashtra and Gujarat are unmatched.",
  },
  {
    id: 2,
    name: "Ananya Deshmukh",
    role: "Head of Advanced Machining",
    company: "Tata Precision Aerospace, Bengaluru",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    quote:
      "We were delighted with how Sojar Solutions custom-engineered precision carbide tooling for our 5-axis CNC lines. Sub-micron accuracy and zero defect rates across all aerospace production batches.",
  },
  {
    id: 3,
    name: "Vikram Patel",
    role: "Director of Operations",
    company: "Gujarat Heavy Eng. & Tooling, Ahmedabad",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    quote:
      "Their custom wear parts and specialized carbide drills have delivered exceptional durability in our heavy engineering facility. Sojar Solutions is our primary vendor for high-performance tooling.",
  },
  {
    id: 4,
    name: "Suresh K. Nair",
    role: "General Manager – Tooling Division",
    company: "L&T Precision Machining, Coimbatore",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    quote:
      "From rapid prototyping of complex form tools to bulk supply of oscillating blades, their technical team provides world-class application engineering support right when we need it.",
  },
  {
    id: 5,
    name: "Pooja Sharma",
    role: "Chief Quality & Production Engineer",
    company: "Mahindra Component Machining, Chennai",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    quote:
      "Sub-micron dimensional accuracy and superior surface finish on all carbide inserts. Sojar Solutions continues to elevate our production efficiency and machining economics.",
  },
];

// Top Indian Manufacturing & Industrial Engineering Enterprise Logos
const CLIENT_LOGOS = [
  {
    name: "TATA",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 110 30">
        <g fill="currentColor">
          <ellipse cx="14" cy="15" rx="12" ry="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 11h8M14 11v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <text x="32" y="21" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="17" letterSpacing="2px">TATA</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Larsen & Toubro",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 125 30">
        <g fill="currentColor">
          <rect x="2" y="4" width="26" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="6" y="20" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="13" letterSpacing="0.5px">L&T</text>
          <text x="34" y="15" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10" letterSpacing="0.5px">LARSEN & TOUBRO</text>
          <text x="34" y="24" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="7.5" letterSpacing="1px" opacity="0.7">ENGINEERING</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Bharat Forge",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 145 30">
        <g fill="currentColor">
          <polygon points="12,3 22,9 22,21 12,27 2,21 2,9" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="15" r="3.5" />
          <text x="28" y="16" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="11" letterSpacing="1px">BHARAT FORGE</text>
          <text x="28" y="24" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="7.5" letterSpacing="0.8px" opacity="0.7">KALYANI GROUP</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Mahindra",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 120 30">
        <g fill="currentColor">
          <path d="M4 22L12 8l4 7 4-7 8 14h-4l-4-8-4 7-4-7-4 8H4z" />
          <text x="34" y="21" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="14" letterSpacing="0.5px">Mahindra</text>
        </g>
      </svg>
    ),
  },
  {
    name: "BHEL",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 105 30">
        <g fill="currentColor">
          <circle cx="12" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 5v20M2 15h20M5 8l14 14M5 22L19 8" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
          <text x="28" y="21" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="17" letterSpacing="1.5px">BHEL</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Godrej",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 135 30">
        <g fill="currentColor">
          <text x="2" y="22" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="22" letterSpacing="0.5px">Godrej</text>
          <text x="75" y="16" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="7" letterSpacing="1px" opacity="0.8">PRECISION</text>
          <text x="75" y="24" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="7" letterSpacing="1px" opacity="0.8">ENGINEERING</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Ashok Leyland",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 155 30">
        <g fill="currentColor">
          <circle cx="12" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <polygon points="8,9 16,9 12,21" />
          <text x="28" y="16" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10.5" letterSpacing="0.8px">ASHOK LEYLAND</text>
          <text x="28" y="24" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="7" letterSpacing="0.8px" opacity="0.7">HINDUJA GROUP</text>
        </g>
      </svg>
    ),
  },
  {
    name: "HAL",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 115 30">
        <g fill="currentColor">
          <path d="M3 20L14 6l11 14H18l-4-6-4 6H3z" />
          <text x="30" y="21" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="18" letterSpacing="2px">HAL</text>
        </g>
      </svg>
    ),
  },
  {
    name: "TVS Motor",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 100 30">
        <g fill="currentColor">
          <path d="M3 8h10v4H3zm13 0h6l4 14h-5l-1-4h-3l-1 4h-5z" opacity="0.8" />
          <text x="2" y="22" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="18" letterSpacing="1px">TVS</text>
          <text x="44" y="20" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="9" letterSpacing="1.2px" opacity="0.7">MOTOR</text>
        </g>
      </svg>
    ),
  },
  {
    name: "Kirloskar",
    svg: (
      <svg className="h-6 sm:h-7 w-auto fill-current" viewBox="0 0 120 30">
        <g fill="currentColor">
          <rect x="3" y="7" width="16" height="16" rx="2" transform="rotate(45 11 15)" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="11" cy="15" r="3" />
          <text x="28" y="20" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="14" letterSpacing="0.5px">Kirloskar</text>
        </g>
      </svg>
    ),
  },
];

export function ClientTestimonialsSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [columnWidth, setColumnWidth] = useState(0);

  const columnRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch swipe support for mobile & tablet
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = TESTIMONIALS.length;

  useEffect(() => {
    const updateWidth = () => {
      if (columnRef.current) {
        setColumnWidth(columnRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleNext = useCallback(() => {
    setHasNavigated(true);
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    setHasNavigated(true);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      handleNext();
    } else if (distance < -45) {
      handlePrev();
    }
  };

  // Autoplay (7 seconds), pauses on user hover
  useEffect(() => {
    if (isHovered) return;
    autoPlayRef.current = setTimeout(() => {
      handleNext();
    }, 7000);

    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [currentIndex, isHovered, handleNext]);

  // Responsive card sizes and offsets based on measured columnWidth
  let cardWidth = 380;
  let foregroundOffset = 180;
  let gap = 24;
  let stageHeight = 295;

  if (columnWidth > 0) {
    if (columnWidth < 420) {
      // Small phones (<420px)
      cardWidth = Math.max(220, Math.min(280, columnWidth - 46));
      foregroundOffset = Math.round(cardWidth * 0.15); // subtle peek of left overlay
      gap = 12;
      stageHeight = 315;
    } else if (columnWidth < 640) {
      // Medium to large phones (420px - 640px)
      cardWidth = Math.max(270, Math.min(330, Math.round(columnWidth * 0.76)));
      foregroundOffset = Math.round(cardWidth * 0.20);
      gap = 16;
      stageHeight = 295;
    } else if (columnWidth < 1024) {
      // Tablets (640px - 1024px)
      cardWidth = Math.min(360, Math.round(columnWidth * 0.65));
      foregroundOffset = Math.round(cardWidth * 0.28);
      gap = 20;
      stageHeight = 290;
    } else {
      // Desktop (1024px+)
      cardWidth = 380;
      foregroundOffset = 180;
      gap = 24;
      stageHeight = 295;
    }
  }

  // In initial state (before navigation): stage shows active card at 0 + 20% right peek
  // Once navigated: stage shows left overlay (back down) + active card in position + 20% of right overlay (next card)
  const isInitialState = !hasNavigated && currentIndex === 0;
  const peekWidth = Math.round(cardWidth * 0.20);
  const visibleStageWidth = isInitialState
    ? cardWidth + gap + peekWidth
    : foregroundOffset + cardWidth + gap + peekWidth;

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16 bg-white select-none">
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        
        {/* Rounded Off-White Outer Container */}
        <div
          className="relative w-full rounded-2xl sm:rounded-[32px] bg-[#F4F4F6] p-5 sm:p-8 md:p-10 lg:p-14 overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Top Row: Left Column (Headline + Bottom Arrows) & Right Column (Dynamic Layered Stage) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-stretch">
            
            {/* Left Column: Eyebrow + Headline at top, Navigation Arrows aligned at bottom */}
            <div className="lg:col-span-5 flex flex-col justify-between z-10 min-h-0 lg:min-h-[260px]">
              <div className="flex items-end justify-between lg:block">
                <div className="space-y-2 sm:space-y-3">
                  <span className="block text-xs font-bold uppercase tracking-widest text-slate-400 font-skoda">
                    CLIENTS
                  </span>
                  <h2 className="font-skoda text-2xl sm:text-3xl lg:text-[42px] font-bold text-slate-900 leading-[1.18] tracking-tight">
                    What people say <br className="hidden sm:inline" />
                    about us?
                  </h2>
                </div>

                {/* Mobile / Tablet Arrow Controls (visible on < lg) */}
                <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous testimonial"
                    className="group flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-slate-800 hover:text-slate-950 bg-white/80 hover:bg-white active:scale-95 shadow-xs transition-all duration-200 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2] transition-transform group-hover:-translate-x-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next testimonial"
                    className="group flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-slate-800 hover:text-slate-950 bg-white/80 hover:bg-white active:scale-95 shadow-xs transition-all duration-200 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2] transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>

              {/* Desktop Slider Arrows (visible on lg+) */}
              <div className="hidden lg:flex items-center gap-3 pt-6 lg:pt-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous testimonial"
                  className="group flex items-center justify-center w-10 h-10 rounded-full text-slate-800 hover:text-slate-950 hover:bg-slate-200/80 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2] transition-transform group-hover:-translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next testimonial"
                  className="group flex items-center justify-center w-10 h-10 rounded-full text-slate-800 hover:text-slate-950 hover:bg-slate-200/80 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  <ArrowRight className="w-5 h-5 stroke-[2] transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* Right Column: Layered Interactive Sliding Stage */}
            <div
              ref={columnRef}
              className="lg:col-span-7 flex items-center w-full overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                style={{
                  maxWidth: columnWidth > 0 ? `${Math.min(visibleStageWidth, columnWidth)}px` : `${visibleStageWidth}px`,
                  height: `${stageHeight}px`,
                }}
                className="relative w-full overflow-hidden py-1 transition-[max-width,height] duration-750 ease-[cubic-bezier(0.25,1,0.5,1)]"
              >
                {TESTIMONIALS.map((testimonial, idx) => {
                  // Normalize circular offset between -1, 0, 1
                  let offset = idx - currentIndex;
                  if (offset < -1 && currentIndex === total - 1 && idx === 0) {
                    offset = 1;
                  } else if (offset > 1 && currentIndex === 0 && idx === total - 1 && hasNavigated) {
                    offset = -1;
                  }

                  // Determine position, opacity, scale, and z-index for each card
                  let translateX = 0;
                  let opacity = 0;
                  let zIndex = 0;
                  let scale = 0.96;
                  let isClickable = false;

                  if (offset === 0) {
                    // Actual active card: takes position (at 0 on initial, or at foregroundOffset once navigated)
                    translateX = isInitialState ? 0 : foregroundOffset;
                    opacity = 1;
                    zIndex = 20;
                    scale = 1;
                    isClickable = false;
                  } else if (offset === -1 && (!isInitialState || hasNavigated)) {
                    // Left overlay card: sits on left at 0, back down in background
                    translateX = 0;
                    opacity = 0.35;
                    zIndex = 10;
                    scale = 0.96;
                    isClickable = true;
                  } else if (offset === 1) {
                    // Right overlay card: comes with next card, peeking in by 20%
                    translateX = isInitialState
                      ? cardWidth + gap
                      : foregroundOffset + cardWidth + gap;
                    opacity = 0.35;
                    zIndex = 10;
                    scale = 0.96;
                    isClickable = true;
                  } else if (offset < -1) {
                    // Previous cards off to the left
                    translateX = -cardWidth - 60;
                    opacity = 0;
                    zIndex = 0;
                  } else {
                    // Upcoming cards to the right
                    translateX =
                      (isInitialState ? cardWidth : foregroundOffset + cardWidth) +
                      gap +
                      cardWidth +
                      60;
                    opacity = 0;
                    zIndex = 0;
                  }

                  return (
                    <div
                      key={testimonial.id}
                      onClick={() => isClickable && (setHasNavigated(true), setCurrentIndex(idx))}
                      style={{
                        width: `${cardWidth}px`,
                        height: `${stageHeight - 12}px`,
                        transform: `translateX(${translateX}px) scale(${scale})`,
                        opacity,
                        zIndex,
                      }}
                      className={`absolute top-0 left-0 rounded-2xl sm:rounded-[28px] p-5 sm:p-7 lg:p-8 bg-white border transition-all duration-750 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col justify-between select-none ${
                        offset === 0
                          ? "shadow-xl sm:shadow-2xl shadow-slate-300/60 border-slate-100/90 cursor-default"
                          : isClickable
                          ? "shadow-sm border-slate-200/60 hover:opacity-60 cursor-pointer"
                          : "pointer-events-none"
                      }`}
                    >
                      {/* Author Header */}
                      <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-4">
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border border-slate-100 shadow-xs">
                          <Image
                            src={testimonial.avatar}
                            alt={testimonial.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 40px, 48px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base font-skoda leading-tight truncate">
                            {testimonial.name}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-500 font-subheading mt-0.5 line-clamp-1">
                            {testimonial.role}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 font-subheading truncate">
                            {testimonial.company}
                          </p>
                        </div>
                      </div>

                      {/* Quote */}
                      <p className="text-slate-700 text-xs sm:text-[13.5px] lg:text-[14.5px] leading-relaxed font-subheading line-clamp-6 sm:line-clamp-none">
                        “{testimonial.quote}”
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Bottom Row: Infinite Seamless Scrolling Logo Slider */}
          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-slate-200/70">
            <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
              <div className="flex w-max animate-infinite-marquee gap-10 sm:gap-16 items-center text-slate-500 py-1">
                {/* First set */}
                {CLIENT_LOGOS.map((client, i) => (
                  <div
                    key={`logo-1-${i}`}
                    className="shrink-0 grayscale opacity-55 hover:opacity-100 hover:text-slate-900 transition-all duration-300 cursor-pointer"
                    title={client.name}
                  >
                    {client.svg}
                  </div>
                ))}
                {/* Second set for continuous infinite loop */}
                {CLIENT_LOGOS.map((client, i) => (
                  <div
                    key={`logo-2-${i}`}
                    aria-hidden="true"
                    className="shrink-0 grayscale opacity-55 hover:opacity-100 hover:text-slate-900 transition-all duration-300 cursor-pointer"
                    title={client.name}
                  >
                    {client.svg}
                  </div>
                ))}
                {/* Third set to guarantee full width on ultra-wide screens */}
                {CLIENT_LOGOS.map((client, i) => (
                  <div
                    key={`logo-3-${i}`}
                    aria-hidden="true"
                    className="shrink-0 grayscale opacity-55 hover:opacity-100 hover:text-slate-900 transition-all duration-300 cursor-pointer"
                    title={client.name}
                  >
                    {client.svg}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Global CSS for Infinite Logo Marquee */}
      <style jsx global>{`
        @keyframes infiniteMarquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100% / 3));
          }
        }

        .animate-infinite-marquee {
          animation: infiniteMarquee 34s linear infinite;
        }

        .animate-infinite-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
