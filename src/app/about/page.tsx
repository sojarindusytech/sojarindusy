import React from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { CheckCircle2, Target, Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | Sojar Solutions",
  description:
    "Learn about Sojar Solutions - Industrial manufacturing leaders in precision engineering and high-performance tooling solutions.",
};

export default function AboutPage() {
  const cards = [
    {
      id: "facilities",
      title: "Facilities And Technology",
      subtitle: "State-of-the-Art Facilities for Manufacturing, Research, and Testing.",
      desc: "Our commitment to excellence is reflected in our state-of-the-art facilities. Equipped with advanced machinery, precision tools, and cutting-edge technology, our manufacturing, research, and testing units are designed to produce high-performance tooling solutions that meet the exacting demands of modern engineering and manufacturing industries. commitment to excellence drives our dedicated team of professionals to consistently deliver value and innovation to our clients.",
      icon: <CheckCircle2 className="h-6 w-6 text-slate-500 shrink-0 stroke-[2.2]" />,
    },
    {
      id: "mission",
      title: "Our Mission And Value",
      subtitle: "Driven by Excellence. Engineering Solutions Beyond Boundaries.",
      desc: "At the core of our operations lies our mission to deliver unparalleled tooling solutions that meet the dynamic demands of modern engineering. Guided by our core values-integrity, innovation, and an unwavering commitment to customer satisfaction-we strive to build lasting trust and create meaningful value in every partnership.",
      icon: <Target className="h-6 w-6 text-slate-500 shrink-0 stroke-[2.2]" />,
    },
    {
      id: "quality",
      title: "Quality & Environmental Responsibility",
      subtitle: "Excellence in Every Detail - Our Commitment to Quality",
      desc: "We are committed to delivering precision, durability, and excellence in every tooling solution. Using certified materials and rigorous testing, we ensure top-quality performance while following eco-conscious practices to minimize our environmental impact.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-slate-500 shrink-0 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round"
        >
          <path d="m12 3-1.9 2.1-2.8-.4-1 2.6-2.6 1 .4 2.8L2 13l2.1 1.9-.4 2.8 2.6 1 1 2.6 2.8-.4L12 23l1.9-2.1 2.8.4 1-2.6 2.6-1-.4-2.8L22 13l-2.1-1.9.4-2.8-2.6-1-1-2.6-2.8.4Z" />
        </svg>
      ),
    },
    {
      id: "trust",
      title: "Trust In Us",
      subtitle: "Building the Future, Together in Excellence",
      desc: "Our clients trust us for precision-engineered tooling solutions. With a focus on quality and innovation, we deliver reliable results that inspire confidence and long-term collaboration.",
      icon: <Handshake className="h-6 w-6 text-slate-500 shrink-0 stroke-[2.2]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-white py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-12 lg:space-y-16">
        
        {/* Top Story Section */}
        <div className="space-y-8 lg:space-y-10">
          <div className="space-y-3">
            <p className="font-skoda text-sm sm:text-base font-bold text-slate-900 tracking-wide">
              We are SOJAR SOLUTIONS.
            </p>
            <h1 className="font-skoda text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 leading-[1.2] tracking-tight max-w-4xl">
              Where Precision is crafted and Excellence is defined
            </h1>
          </div>

          {/* Grid: 2 Text Paragraphs (Left) + Building Photo (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left 2 paragraphs */}
            <div className="lg:col-span-7 space-y-6 text-slate-700 text-[0.95rem] sm:text-base leading-relaxed font-subheading">
              <p>
                SOJAR SOLUTIONS stands at the forefront of precision engineering. We specialize in the design and development of high-performance tooling solutions essential for modern engineering and manufacturing. From precision carbide tools to custom wear parts; our products are crafted to deliver durability, accuracy, and innovation—empowering industries to achieve higher efficiency and reliability.
              </p>
              <p>
                With over a decade of expertise in engineering design and development, Sojar Solutions provides premium-quality tooling solutions for industries such as die & mould making, medical devices, automotive, aerospace, oil & gas, power generation, and general engineering. Specializing in solid carbide tooling, the company combines reliability and innovation to deliver performance that meets the evolving demands of modern manufacturing.
              </p>
            </div>

            {/* Right Building Image */}
            <div className="lg:col-span-5">
              <div className="relative w-full aspect-[16/10] sm:aspect-[16/10] rounded-xl overflow-hidden shadow-md border border-slate-200/80">
                <Image
                  src="/assets/images/about-us.png"
                  alt="Sojar Solutions Manufacturing Facility"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 500px"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Full-width concluding paragraphs */}
          <div className="space-y-4 text-slate-700 text-[0.95rem] sm:text-base leading-relaxed font-subheading pt-2">
            <p>
              Our product portfolio includes premium-quality solid carbide end mills, ball nose cutters, drills, inserts, oscillating blades, and complete metalworking solutions, tailored to address complex industrial challenges. In addition, customized tungsten carbide wear parts are manufactured for precise, reliable industrial performance.
            </p>
            <p className="font-medium text-slate-900">
              Certified by MSME UDYAM and ISO 9001:2015, we ensure quality, reliability, and long-term partnerships.
            </p>
          </div>
        </div>

        {/* 4 Cards Section (2x2 Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 pt-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-2xl border border-slate-200/70 bg-[#FBFDFF] p-6 sm:p-8 space-y-3.5 shadow-xs hover:shadow-md transition-shadow duration-200"
            >
              {/* Card Header with Icon & Title */}
              <div className="flex items-center gap-3">
                {card.icon}
                <h3 className="font-skoda text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {card.title}
                </h3>
              </div>

              {/* Subheading in Brand Blue */}
              <p className="text-[#024AE5] font-semibold text-sm sm:text-[0.95rem] leading-snug font-skoda">
                {card.subtitle}
              </p>

              {/* Card Body */}
              <p className="text-slate-600 text-xs sm:text-[0.875rem] leading-relaxed font-subheading">
                {card.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
