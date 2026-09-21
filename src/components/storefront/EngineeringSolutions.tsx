import { cn } from "@/lib/utils";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function EngineeringSolutions() {
  const PRIMARY_THEME = "#024AE5"; // Primary website theme cobalt blue

  const features: FeatureCard[] = [
    {
      id: "quality",
      title: "Quality",
      description:
        "We supply high-performance solid carbide tooling solutions and design customized solid carbide wear parts, meticulously crafted to meet the highest standards of precision, durability, and quality for safe and efficient industrial applications.",
      icon: (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-white"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Left Ribbon Tail with Swallowtail Notch */}
          <path
            d="M38 64 L22 88 L38 80 L44 88 L48 68"
            strokeWidth="3.2"
            fill="none"
          />
          {/* Right Ribbon Tail with Swallowtail Notch */}
          <path
            d="M62 64 L78 88 L62 80 L56 88 L52 68"
            strokeWidth="3.2"
            fill="none"
          />
          {/* Outer Medal Circle */}
          <circle cx="50" cy="42" r="26" strokeWidth="3.2" />
          {/* Dotted Inner Ring */}
          <circle
            cx="50"
            cy="42"
            r="20"
            strokeWidth="2.8"
            strokeDasharray="0.1 4.7"
            strokeLinecap="round"
          />
          {/* Left 5-Pointed Star */}
          <polygon
            points="37,42 38.3,43.2 37.8,44.9 39.5,43.9 41.2,44.9 40.7,43.2 42,42 40.3,41.8 39.5,40.1 38.7,41.8"
            fill="white"
            stroke="white"
            strokeWidth="0.5"
          />
          {/* Number 1 in center */}
          <path
            d="M48 37.5 L51.5 34 V50.5 M46.5 50.5 H55.5"
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right 5-Pointed Star */}
          <polygon
            points="58,42 59.3,43.2 58.8,44.9 60.5,43.9 62.2,44.9 61.7,43.2 63,42 61.3,41.8 60.5,40.1 59.7,41.8"
            fill="white"
            stroke="white"
            strokeWidth="0.5"
          />
        </svg>
      ),
    },
    {
      id: "technology",
      title: "Technology",
      description:
        "Our expert team and advanced technology enable us to supply premium solid carbide tooling and deliver customized carbide wear parts, ensuring exceptional precision, consistent quality, and reliable service tailored to your industrial needs.",
      icon: (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-white"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Main Outer Bracket Shell (starts at top-left pad trace, wraps around top-left, left, and bottom edges) */}
          <path
            d="M 41.2 32.8 L 54 20 H 26 C 22.7 20 20 22.7 20 26 V 74 C 20 77.3 22.7 80 26 80 H 70"
            strokeWidth="3.2"
            fill="none"
          />

          {/* Top-Right Outer Bracket Shell (from top 45-deg cut around top-right corner to bottom-right cut) */}
          <path
            d="M 64 20 H 74 C 77.3 20 80 22.7 80 26 V 70"
            strokeWidth="3.2"
            fill="none"
          />

          {/* Central Connecting Diagonal Trace between Bottom-Left Pad and Top-Right Pad */}
          <line x1="41.2" y1="58.8" x2="58.8" y2="41.2" strokeWidth="3.2" strokeLinecap="round" />

          {/* Bottom-Right Diagonal Trace exiting through the 45-deg corner gap */}
          <line x1="67.2" y1="67.2" x2="78" y2="78" strokeWidth="3.2" strokeLinecap="round" />

          {/* 4 Single-Ring Circular Pads */}
          <circle cx="37" cy="37" r="6" strokeWidth="3.2" fill="none" />
          <circle cx="37" cy="63" r="6" strokeWidth="3.2" fill="none" />
          <circle cx="63" cy="37" r="6" strokeWidth="3.2" fill="none" />
          <circle cx="63" cy="63" r="6" strokeWidth="3.2" fill="none" />
        </svg>
      ),
    },
    {
      id: "solutions",
      title: "Solutions",
      description:
        "Leveraging our expertise in understanding industrial requirements, we supply premium solid carbide tooling and provide customized carbide wear parts, delivering solutions precisely tailored to meet each customer’s unique needs.",
      icon: (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-white"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Bulb Dome Outline */}
          <path
            d="M 33 46 C 33 36.5 40.5 28 50 28 C 59.5 28 67 36.5 67 46 C 67 52.5 63 56.5 61 60.5 L 59.5 64 H 40.5 L 39 60.5 C 37 56.5 33 52.5 33 46 Z"
            strokeWidth="3.2"
          />

          {/* Screw Base Threads */}
          <line x1="41" y1="67.5" x2="59" y2="67.5" strokeWidth="3" strokeLinecap="round" />
          <line x1="42.5" y1="72" x2="57.5" y2="72" strokeWidth="3" strokeLinecap="round" />
          <line x1="44" y1="76.5" x2="56" y2="76.5" strokeWidth="3" strokeLinecap="round" />
          {/* Contact Tip */}
          <path d="M 47 77 C 47 80.5 53 80.5 53 77" strokeWidth="2.8" strokeLinecap="round" />

          {/* 6-Toothed Industrial Gear / Cogwheel (Surrounding Checkmark) */}
          <path
            d="M 47.4 32.7
               L 52.6 32.7
               L 53.2 36.7
               L 56.4 38.6
               L 60.2 37.1
               L 62.8 41.6
               L 59.6 44.1
               L 59.6 47.9
               L 62.8 50.4
               L 60.2 54.9
               L 56.4 53.4
               L 53.2 55.3
               L 52.6 59.3
               L 47.4 59.3
               L 46.8 55.3
               L 43.6 53.4
               L 39.8 54.9
               L 37.2 50.4
               L 40.4 47.9
               L 40.4 44.1
               L 37.2 41.6
               L 39.8 37.1
               L 43.6 38.6
               L 46.8 36.7
               Z"
            strokeWidth="2.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />

          {/* Checkmark inside Gear */}
          <path
            d="M 45 46.2 L 48.5 49.7 L 55 43.2"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 7 Solid Radiating Rays */}
          {/* Top Ray (12 o'clock) */}
          <line x1="50" y1="13" x2="50" y2="20" strokeWidth="3.2" strokeLinecap="round" />
          {/* Left Ray (9 o'clock) */}
          <line x1="16" y1="46" x2="23" y2="46" strokeWidth="3.2" strokeLinecap="round" />
          {/* Right Ray (3 o'clock) */}
          <line x1="77" y1="46" x2="84" y2="46" strokeWidth="3.2" strokeLinecap="round" />
          {/* Top-Left Ray (10:30) */}
          <line x1="27" y1="23" x2="33" y2="29" strokeWidth="3.2" strokeLinecap="round" />
          {/* Top-Right Ray (1:30) */}
          <line x1="73" y1="23" x2="67" y2="29" strokeWidth="3.2" strokeLinecap="round" />
          {/* Bottom-Left Ray (7:30) */}
          <line x1="27" y1="69" x2="33" y2="63" strokeWidth="3.2" strokeLinecap="round" />
          {/* Bottom-Right Ray (4:30) */}
          <line x1="73" y1="69" x2="67" y2="63" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <section className="bg-white py-10 sm:py-14 border-t border-slate-100">
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Section Top Header: Left Eyebrow & Title with Accent Bar, Right Narrative */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start justify-between">
          {/* Left Column: Accent Bar + Eyebrow + Main Title */}
          <div className="lg:col-span-7 flex gap-4 sm:gap-5 items-stretch">
            {/* Vertical Accent Bar */}
            <div
              className="w-1 sm:w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: PRIMARY_THEME }}
            />

            <div className="space-y-2">
              <span className="block text-xs sm:text-sm font-semibold tracking-wider text-slate-500 uppercase font-subheading">
                CRAFTING INDUSTRIAL EXCELLENCE
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 leading-[1.2] font-skoda">
                Engineering{" "}
                <span style={{ color: PRIMARY_THEME }} className="text-[#024AE5]">
                  Durable Solutions
                </span>{" "}
                For Industrial Challenges
              </h2>
            </div>
          </div>

          {/* Right Column: Paragraph Narrative */}
          <div className="lg:col-span-5 pt-1 lg:pt-3">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-subheading">
              We specialize in supplying premium solid carbide tooling and customized carbide wear parts, delivering high-precision, reliable solutions tailored to tackle complex industrial challenges.
            </p>
          </div>
        </div>

        {/* 3 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-16">
          {features.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-start rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 lg:p-9 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
              style={{
                border: `2px solid ${PRIMARY_THEME}`,
              }}
            >
              {/* Icon Badge - Prominent Rounded Squircle */}
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center p-3.5 sm:p-4 mb-6 sm:mb-8 shadow-sm transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundColor: PRIMARY_THEME }}
              >
                {item.icon}
              </div>

              {/* Card Title */}
              <h3
                className="text-2xl sm:text-3xl font-bold tracking-tight font-skoda mb-3.5"
                style={{ color: PRIMARY_THEME }}
              >
                {item.title}
              </h3>

              {/* Card Body Description */}
              <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed font-body">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
