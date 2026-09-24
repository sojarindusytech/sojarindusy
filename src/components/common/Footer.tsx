"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SocialLinks } from "@/components/common/SocialLinks";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Products", href: "/products" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
];

const PRODUCTS_LINKS = [
  { label: "Customized Carbide Wear Parts", href: "/products/carbide-parts" },
  { label: "End Mills", href: "/products/end-mills" },
  { label: "Drills", href: "/products/drills" },
  { label: "Oscillating Blades", href: "/products/oscillating-blades" },
];

export function Footer() {
  const pathname = usePathname();

  // Hide footer on dashboard, admin, and auth screens
  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pending-approval") ||
    pathname.startsWith("/auth");

  if (isDashboardRoute) {
    return null;
  }

  return (
    <footer className="w-full bg-[#F5F5F7] border-t border-slate-200/90 text-slate-900">
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16 space-y-14 sm:space-y-16">
        
        {/* Top Section: About Us (Left) + Quick Links & Products (Right, aligned to green line) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Left Column: About Us */}
          <div className="lg:col-span-6 space-y-4 sm:space-y-5">
            <h2 className="font-skoda text-3xl sm:text-4xl lg:text-[2.6rem] font-bold text-slate-900 tracking-tight leading-none">
              About Us
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-lg font-subheading">
              SOJAR SOLUTIONS stands at the forefront of precision engineering. We specialize in the design and development of high-performance tooling solutions essential for modern engineering and manufacturing. From precision carbide tools to custom wear parts; our products are crafted to deliver durability, accuracy, and innovation.
            </p>

            <div className="pt-1">
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#024AE5] hover:text-[#013bb8] transition-colors group"
              >
                <span>Explore our journey & facilities</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Quick Links & Products (Aligned to green axis line) */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-8 sm:gap-10">
            
            {/* Quick Links (Starts directly at the green line) */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-skoda">
                Quick Links
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm font-subheading">
                {QUICK_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-600 hover:text-[#024AE5] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Products */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-skoda">
                Products
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm font-subheading">
                {PRODUCTS_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-600 hover:text-[#024AE5] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Middle Section: Manufacturing Unit (Left) + Contact Numbers & Operations (Right, aligned to green line) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pt-2 text-xs text-slate-600 font-subheading">
          {/* Left: Manufacturing Unit & Office */}
          <div className="lg:col-span-6 space-y-1">
            <span className="block font-bold text-slate-900 uppercase tracking-wide text-[11px] font-skoda">
              Manufacturing Unit & Office
            </span>
            <p className="leading-relaxed max-w-lg">
              Plot No. 7, Behind Hotel La Carta, Near Silvassa Road lines, N.H. No. 8, GIDC Char Rasta, Vapi, Valsad-396191, Gujarat, India
            </p>
          </div>

          {/* Right: Contact Numbers & Operations (Starts directly at the green line) */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-8 sm:gap-10">
            {/* Contact Numbers */}
            <div className="space-y-1">
              <span className="block font-bold text-slate-900 uppercase tracking-wide text-[11px] font-skoda">
                Contact Numbers
              </span>
              <div className="space-y-0.5">
                <div>
                  <a href="tel:+919820701219" className="hover:text-[#024AE5] transition-colors font-medium">
                    +91-982-070-1219
                  </a>
                </div>
                <div>
                  <a href="tel:+919879337908" className="hover:text-[#024AE5] transition-colors font-medium">
                    +91-987-933-7908
                  </a>
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="space-y-1">
              <span className="block font-bold text-slate-900 uppercase tracking-wide text-[11px] font-skoda">
                Operations
              </span>
              <p className="leading-relaxed">
                Mon – Sat: 9:00 AM – 6:00 PM (IST)<br />
                Sunday: Closed
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Giant Brand Wordmark (Left) + Social Links & Narrative (Right, aligned to green line) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end pt-4">
          
          {/* Bottom-Left: Giant Brand Wordmark */}
          <div className="lg:col-span-6">
            <Link href="/" className="inline-block group">
              <span className="font-skoda text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter text-slate-900 transition-colors group-hover:text-[#024AE5] select-none">
                Sojar Solutions
              </span>
            </Link>
          </div>

          {/* Bottom-Right: Social Icons + Divider + Mission Narrative (Starts directly at the green line) */}
          <div className="lg:col-span-6 space-y-3.5">
            {/* Social Links Row (Starts flush at the green axis line) */}
            <div className="flex items-center">
              <SocialLinks
                variant="simple"
                className="flex items-center gap-4"
                itemClassName="text-slate-600 hover:text-[#024AE5] transition-colors py-1 pr-2 first:pl-0"
                iconClassName="w-4 h-4 sm:w-5 sm:h-5 fill-current"
              />
            </div>

            {/* Divider Line */}
            <div className="w-full border-t border-slate-200" />

            {/* Narrative & Copyright */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 font-subheading">
              <p className="max-w-md leading-relaxed text-slate-500">
                Sojar Solutions builds reliable solid carbide tooling engineered to simplify complexity and accelerate industrial manufacturing productivity.
              </p>
              <p className="shrink-0 text-slate-600 font-medium">
                © {new Date().getFullYear()} Sojar Solutions
              </p>
            </div>
          </div>

        </div>

      </div>
    </footer>
  );
}
