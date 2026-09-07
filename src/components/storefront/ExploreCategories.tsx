import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  image: string;
  href: string;
}

const HARDCODED_CATEGORIES: CategoryItem[] = [
  {
    id: "end-mills",
    name: "End Mills",
    image: "/assets/category/end mills.png",
    href: "/products/end-mills",
  },
  {
    id: "drills",
    name: "Drills",
    image: "/assets/category/drills.png",
    href: "/products/drills",
  },
  {
    id: "oscillating-blades",
    name: "Oscillating Blades",
    image: "/assets/category/oscillating blades.png",
    href: "/products/oscillating-blades",
  },
  {
    id: "carbide-parts",
    name: "Carbide Parts",
    image: "/assets/category/carbide parts.png",
    href: "/products/carbide-parts",
  },
];

export function ExploreCategories() {
  return (
    <section className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16">
      <div className="space-y-6">
        {/* Section Heading matching Sandvik Reference */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Explore our product categories
        </h2>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {HARDCODED_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className="group block overflow-hidden rounded-xs border border-slate-200/80 bg-white transition-all duration-300 hover:shadow-md cursor-pointer"
            >
              {/* Category Image Box */}
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px"
                />
              </div>

              {/* Bottom Dark Category Bar */}
              <div className="flex items-center justify-between bg-[#4a4d50] px-3.5 py-3 text-white transition-colors duration-200 group-hover:bg-[#3d4043]">
                <span className="text-xs sm:text-sm font-semibold tracking-normal truncate">
                  {cat.name}
                </span>
                <ChevronRight className="h-4 w-4 text-white/80 shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
