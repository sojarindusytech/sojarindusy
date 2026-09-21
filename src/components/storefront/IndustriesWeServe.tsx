import Image from "next/image";

const INDUSTRIES = [
  {
    id: "construction",
    title: "Construction & Infrastructure",
    icon: "/assets/icons/industry-we-serve/Icons-01.png",
  },
  {
    id: "die-mould",
    title: "Die & Mould",
    icon: "/assets/icons/industry-we-serve/Icons-02.png",
  },
  {
    id: "oil-gas",
    title: "Oil & Gas",
    icon: "/assets/icons/industry-we-serve/Icons-03.png",
  },
  {
    id: "automotive",
    title: "Automotive",
    icon: "/assets/icons/industry-we-serve/Icons-04.png",
  },
  {
    id: "energy-power",
    title: "Energy & Power",
    icon: "/assets/icons/industry-we-serve/Icons-05.png",
  },
  {
    id: "medical",
    title: "Medical & Healthcare",
    icon: "/assets/icons/industry-we-serve/Icons-06.png",
  },
  {
    id: "general-engineering",
    title: "General Engineering",
    icon: "/assets/icons/industry-we-serve/Icons-07.png",
  },
  {
    id: "aerospace",
    title: "Aerospace & Defence",
    icon: "/assets/icons/industry-we-serve/Icons-08.png",
  },
];

export function IndustriesWeServe() {
  return (
    <section className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="space-y-6">
        {/* Section Heading */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-skoda">
          Industries We Serve
        </h2>

        {/* 4-column grid on desktop, 2-column on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {INDUSTRIES.map((ind) => (
            <div
              key={ind.id}
              className="group flex flex-col items-center rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer"
            >
              {/* Icon */}
              <div className="relative w-full aspect-square max-w-[150px] sm:max-w-[190px] lg:max-w-[220px] rounded-xl sm:rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-[1.04]">
                <Image
                  src={ind.icon}
                  alt={ind.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 220px"
                />
              </div>

              {/* Industry Title */}
              <h3 className="mt-3.5 sm:mt-4 text-xs sm:text-sm lg:text-base font-bold text-slate-900 tracking-tight text-center font-skoda">
                {ind.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
