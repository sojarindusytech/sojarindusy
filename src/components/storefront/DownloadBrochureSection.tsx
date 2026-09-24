import React from "react";
import Image from "next/image";
import { Download } from "lucide-react";

interface DownloadBrochureSectionProps {
  /**
   * Optional custom image URL. Defaults to an industrial precision tooling Unsplash image.
   */
  imageSrc?: string;
  brochureUrl?: string;
}

export function DownloadBrochureSection({
  imageSrc = "/assets/images/brochure-cover.webp",
  brochureUrl = "/assets/sojar-indusy-brochure.pdf",
}: DownloadBrochureSectionProps) {
  return (
    <section className="w-full bg-white py-10 sm:py-14 lg:py-16">
      <div className="container mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Soft Off-White Panel */}
        <div className="bg-[#F8FAFC] border border-slate-100 rounded-3xl p-8 sm:p-12 lg:p-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center">
            {/* Left Column: Brochure Image Mockup */}
            <div className="md:col-span-5 flex justify-center items-center">
              <div className="relative w-[220px] sm:w-[260px] lg:w-[280px] aspect-[3/4] rounded-xl overflow-hidden shadow-2xl shadow-slate-400/25 border border-slate-200/80 transition-transform duration-300 hover:scale-[1.02]">
                <Image
                  src={imageSrc}
                  alt="Sojar Solutions Engineering Solutions Brochure"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 240px, 280px"
                  priority={false}
                />
              </div>
            </div>

            {/* Right Column: Title, Narrative & Download Action */}
            <div className="md:col-span-7 flex flex-col items-center text-center space-y-5 lg:space-y-6">
              <h2 className="font-skoda text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#024AE5] tracking-tight">
                Sojar Solutions
              </h2>

              <p className="text-slate-600 text-sm sm:text-base lg:text-[1.05rem] leading-relaxed max-w-xl font-subheading">
                Download the brochure to explore how Sojar Solutions can be your trusted
                partner in achieving high-precision results with durable and
                innovative tooling solutions.
              </p>

              <div className="pt-1 sm:pt-2">
                <a
                  href={brochureUrl}
                  download="Sojar-Solutions-Brochure.pdf"
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-lg bg-[#024AE5] hover:bg-[#013bb8] text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 cursor-pointer font-skoda"
                >
                  <span>Download Brochure</span>
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
