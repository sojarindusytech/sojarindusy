import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroSlider } from "@/components/storefront/HeroSlider";
import { ExploreCategories } from "@/components/storefront/ExploreCategories";
import { IndustriesWeServe } from "@/components/storefront/IndustriesWeServe";

export default function HomePage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Welcome Section (Directly Below Header) */}
      <section className="container mx-auto max-w-[1400px] px-4 pt-12 pb-8 sm:pt-16 sm:pb-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start justify-between">
          {/* Left Column: Heading */}
          <div className="md:col-span-7 lg:col-span-7">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Welcome to the <br />
              Sojar Indusy
            </h1>
          </div>

          {/* Right Column: Narrative & Action */}
          <div className="md:col-span-5 lg:col-span-5 space-y-6 pt-1 md:pt-2">
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
              We apply our expert minds and collaborative ways of working with customers to build more resilient and stronger businesses.
            </p>
            <div>
              <Link href="/products">
                <Button className="bg-[#024AE5] hover:bg-[#0238B0] text-white font-medium text-xs sm:text-sm px-6 py-2.5 h-auto rounded-none shadow-none transition-colors cursor-pointer">
                  View our offerings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section (Extensible Slider structure, currently 1 slide) */}
      <HeroSlider />

      {/* Explore Product Categories (Hardcoded for Home Page) */}
      <ExploreCategories />

      {/* Industries We Serve Section */}
      <IndustriesWeServe />
    </div>
  );
}
