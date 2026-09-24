import Link from "next/link";
import { HeroSlider } from "@/components/storefront/HeroSlider";
import { ExploreCategories } from "@/components/storefront/ExploreCategories";
import { IndustriesWeServe } from "@/components/storefront/IndustriesWeServe";
import { EngineeringSolutions } from "@/components/storefront/EngineeringSolutions";
import { ClientTestimonialsSlider } from "@/components/storefront/ClientTestimonialsSlider";
import { DownloadBrochureSection } from "@/components/storefront/DownloadBrochureSection";

export default function HomePage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Welcome Section */}
      <section className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center justify-between">
          {/* Left Column: Heading with custom SkodaPro font */}
          <div className="md:col-span-7 lg:col-span-7">
            <h1 
              className="welcome-heading text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-slate-900 leading-[1.15] font-skoda"
              style={{
                WebkitTextStroke: "1.2px #0f172a",
                paintOrder: "stroke fill",
              }}
            >
              Welcome to the <br />
              Sojar Solutions
            </h1>
          </div>

          {/* Right Column: Subheading Narrative & Action */}
          <div className="md:col-span-5 lg:col-span-5 space-y-3.5 pt-1 md:pt-0">
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal font-subheading">
              We apply our expert minds and collaborative ways of working with customers to build more resilient and stronger businesses.
            </p>
            <div>
              <Link
                href="/products"
                className="bg-[#024AE5] hover:bg-[#013bb8] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 cursor-pointer font-skoda inline-flex items-center justify-center"
              >
                View our offerings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Carousel — full-bleed, no side spacing */}
      <HeroSlider />

      {/* All sections — consistent vertical rhythm */}
      <div className="flex flex-col">
        <ExploreCategories />
        <IndustriesWeServe />
        <EngineeringSolutions />
        <ClientTestimonialsSlider />
        <DownloadBrochureSection />
      </div>
    </div>
  );
}

