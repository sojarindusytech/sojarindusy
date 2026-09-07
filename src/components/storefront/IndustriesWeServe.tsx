import { cn } from "@/lib/utils";

interface Industry {
  id: string;
  title: string;
  icon: React.ReactNode;
}

export function IndustriesWeServe() {
  const BADGE_COLOR = "#2b52ba";

  const industries: Industry[] = [
    {
      id: "die-mould",
      title: "Die & Mould",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Top Knob / Pin */}
          <rect x="52" y="16" width="16" height="6" rx="2" fill="white" />
          {/* Top Heavy Die Plate */}
          <rect x="22" y="24" width="76" height="12" rx="3" fill="white" />
          {/* Upper Mould Section */}
          <rect x="28" y="40" width="64" height="13" rx="2" fill="white" />
          {/* Lower Mould Section */}
          <rect x="28" y="57" width="64" height="13" rx="2" fill="white" />
          {/* Ejector Block / Cavity Clamps */}
          <rect x="42" y="74" width="36" height="9" rx="1.5" fill="white" />
          {/* Bottom Clamp Base Plate */}
          <rect x="18" y="86" width="84" height="10" rx="2.5" fill="white" />
        </svg>
      ),
    },
    {
      id: "automotive",
      title: "Automotive",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Main Car Silhouette */}
          <g fill="white">
            <path d="M38 42 C44 26 50 24 60 24 C70 24 76 26 82 42 Z" />
            <path d="M22 52 C22 47 26 44 32 44 L88 44 C94 44 98 47 98 52 L102 68 C103 72 101 76 96 76 L94 76 C94 84 92 90 84 90 L80 90 C78 90 76 86 76 82 L44 82 C44 86 42 90 40 90 L36 90 C28 90 26 84 26 76 L24 76 C19 76 17 72 18 68 Z" />
          </g>
          {/* Front Windshield Cutout */}
          <path d="M42 42 C46 30 52 28 60 28 C68 28 74 30 78 42 Z" fill={BADGE_COLOR} />
          {/* Headlights */}
          <circle cx="32" cy="58" r="5.5" fill={BADGE_COLOR} />
          <circle cx="88" cy="58" r="5.5" fill={BADGE_COLOR} />
          {/* Lower Grille */}
          <rect x="44" y="68" width="32" height="7" rx="3.5" fill={BADGE_COLOR} />
        </svg>
      ),
    },
    {
      id: "general-engineering",
      title: "General Engineering",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Large Main Gear (Top-Left) */}
          <g fill="white">
            <circle cx="48" cy="54" r="23" />
            {/* Teeth on large gear */}
            <rect x="44" y="25" width="8" height="11" rx="2.5" />
            <rect x="44" y="72" width="8" height="11" rx="2.5" />
            <rect x="19" y="50" width="11" height="8" rx="2.5" />
            <rect x="66" y="50" width="11" height="8" rx="2.5" />
            <rect x="27" y="33" width="8" height="10" rx="2.5" transform="rotate(-45 31 38)" />
            <rect x="60" y="66" width="8" height="10" rx="2.5" transform="rotate(-45 64 71)" />
            <rect x="27" y="66" width="8" height="10" rx="2.5" transform="rotate(45 31 71)" />
            <rect x="60" y="33" width="8" height="10" rx="2.5" transform="rotate(45 64 38)" />
          </g>
          {/* Center Hole for Large Gear */}
          <circle cx="48" cy="54" r="10" fill={BADGE_COLOR} />

          {/* Medium Interlocking Gear (Top-Right) */}
          <g fill="white">
            <circle cx="84" cy="38" r="16.5" />
            <rect x="81" y="17" width="6" height="8" rx="2" />
            <rect x="81" y="51" width="6" height="8" rx="2" />
            <rect x="63" y="35" width="8" height="6" rx="2" />
            <rect x="97" y="35" width="8" height="6" rx="2" />
            <rect x="68" y="22" width="6" height="8" rx="2" transform="rotate(-45 71 26)" />
            <rect x="93" y="47" width="6" height="8" rx="2" transform="rotate(-45 96 51)" />
            <rect x="68" y="47" width="6" height="8" rx="2" transform="rotate(45 71 51)" />
            <rect x="93" y="22" width="6" height="8" rx="2" transform="rotate(45 96 26)" />
          </g>
          {/* Center Hole for Top-Right Gear */}
          <circle cx="84" cy="38" r="7" fill={BADGE_COLOR} />

          {/* Small/Medium Interlocking Gear (Bottom-Right) */}
          <g fill="white">
            <circle cx="78" cy="78" r="14" />
            <rect x="75" y="60" width="6" height="7" rx="1.5" />
            <rect x="75" y="89" width="6" height="7" rx="1.5" />
            <rect x="60" y="75" width="7" height="6" rx="1.5" />
            <rect x="89" y="75" width="7" height="6" rx="1.5" />
            <rect x="65" y="65" width="6" height="7" rx="1.5" transform="rotate(-45 68 68.5)" />
            <rect x="85" y="85" width="6" height="7" rx="1.5" transform="rotate(-45 88 88.5)" />
            <rect x="65" y="85" width="6" height="7" rx="1.5" transform="rotate(45 68 88.5)" />
            <rect x="85" y="65" width="6" height="7" rx="1.5" transform="rotate(45 88 68.5)" />
          </g>
          {/* Center Hole for Bottom-Right Gear */}
          <circle cx="78" cy="78" r="5.5" fill={BADGE_COLOR} />
        </svg>
      ),
    },
    {
      id: "oil-gas",
      title: "Oil & Gas",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Base Platform */}
          <rect x="16" y="90" width="88" height="6" rx="2" fill="white" />

          {/* Left Wellhead & Polished Rod */}
          <rect x="22" y="80" width="8" height="10" rx="1" fill="white" />
          <rect x="25" y="38" width="2.5" height="44" fill="white" />

          {/* Center Samson Post / A-Frame Derrick */}
          <g fill="white">
            <path d="M57 48 L76 90 H66 L55 64 L44 90 H34 L53 48 Z" />
            <rect x="42" y="70" width="26" height="3.5" />
            {/* Top Pivot Saddle Bearing */}
            <circle cx="55" cy="48" r="4.5" />
          </g>

          {/* Walking Beam tilted up to the right */}
          <rect
            x="24"
            y="43"
            width="62"
            height="9"
            rx="3"
            transform="rotate(-17 24 43)"
            fill="white"
          />

          {/* Curved Horsehead on Left (Arc Shape) */}
          <path
            d="M26 22 C19 28 17 38 23 48 L29 45 C25 38 26 30 31 25 Z"
            fill="white"
          />
          {/* Cable Connecting Horsehead to Rod */}
          <circle cx="26" cy="23" r="2.5" fill="white" />

          {/* Counterweight & Crank on Right */}
          <g fill="white">
            {/* Pitman Arm from beam to crank */}
            <rect x="80" y="52" width="3.5" height="26" rx="1.5" />
            {/* Counterweight Crank */}
            <ellipse cx="88" cy="68" rx="8" ry="13" transform="rotate(15 88 68)" />
            <rect x="80" y="82" width="16" height="8" rx="2" />
          </g>
        </svg>
      ),
    },
    {
      id: "aerospace",
      title: "Aerospace",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Supersonic Jet Plane Silhouette */}
          <path
            d="M86 24 C91 29 89 36 84 41 L68 57 L67 86 L58 95 L53 82 L38 90 L35 84 L45 72 L32 67 L20 72 L17 67 L27 54 L12 51 L17 44 L40 49 L56 33 C61 28 68 22 73 24 Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      id: "earth-mover",
      title: "Earth Mover",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Undercarriage Crawler Tracks */}
          <rect x="22" y="80" width="56" height="16" rx="8" fill="white" />
          <circle cx="30" cy="88" r="4" fill={BADGE_COLOR} />
          <circle cx="44" cy="88" r="4" fill={BADGE_COLOR} />
          <circle cx="58" cy="88" r="4" fill={BADGE_COLOR} />
          <circle cx="70" cy="88" r="4" fill={BADGE_COLOR} />

          {/* Slew Platform / Turntable */}
          <rect x="36" y="74" width="28" height="6" rx="2" fill="white" />

          {/* Excavator Cab */}
          <path d="M26 56 C26 52 30 50 36 50 L56 50 C62 50 66 54 66 60 L66 74 L26 74 Z" fill="white" />
          {/* Operator Window */}
          <path d="M48 54 L60 54 C61 54 62 55 62 56 L62 66 L48 66 Z" fill={BADGE_COLOR} />

          {/* Articulated Heavy Boom Arm - Clean pure white, fill="none" */}
          <path
            d="M52 58 L72 32 C74 29 78 30 80 33 L98 52 C100 54 99 58 96 58 L90 58"
            fill="none"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Digging Bucket */}
          <path d="M88 56 C95 56 102 62 102 70 L92 76 L86 64 Z" fill="white" />
        </svg>
      ),
    },
    {
      id: "medical-device",
      title: "Medical Device",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Overhead Surgical Lamp Boom */}
          <path d="M22 28 L34 22 L40 34 L28 40 Z" fill="white" />
          <path d="M30 25 L20 16" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />

          {/* Operating Bed / Table Platform */}
          <rect x="20" y="62" width="62" height="9" rx="3" fill="white" />
          <rect x="46" y="71" width="10" height="15" fill="white" />
          {/* Mobile Caster Wheel Base */}
          <rect x="34" y="86" width="34" height="6" rx="2" fill="white" />
          <circle cx="38" cy="95" r="3" fill="white" />
          <circle cx="64" cy="95" r="3" fill="white" />

          {/* Patient Monitor with ECG Waveform */}
          <rect x="64" y="30" width="34" height="24" rx="4" fill="white" />
          <rect x="68" y="34" width="26" height="16" rx="2" fill={BADGE_COLOR} />
          <path
            d="M71 42 H74 L76 38 L79 46 L82 40 L84 42 H91"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="78" y="54" width="6" height="8" fill="white" />
        </svg>
      ),
    },
    {
      id: "power-generation",
      title: "Power Generation",
      icon: (
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Ground Base */}
          <rect x="18" y="94" width="50" height="5" rx="1.5" fill="white" />

          {/* Electric Lattice Transmission Pylon */}
          <path d="M38 94 L46 22 H48 L56 94" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M28 40 H66 M24 58 H70 M32 78 H62" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M28 40 L66 58 M66 40 L28 58 M24 58 L62 78 M70 58 L32 78" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />

          {/* Power Cable Connecting to Generator Badge */}
          <path d="M52 94 C64 96 74 96 82 86 C88 80 88 74 88 68" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />

          {/* Generator / Lightbulb Circle */}
          <circle cx="88" cy="54" r="18" fill="white" />
          <circle cx="88" cy="54" r="14" fill={BADGE_COLOR} />

          {/* Lightning Bolt */}
          <path d="M90 44 L82 54 H90 L86 64 L96 52 H88 L90 44 Z" fill="white" />
        </svg>
      ),
    },
  ];

  return (
    <section className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-24">
      <div className="space-y-6">
        {/* Section Heading */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-skoda">
          Industries We Serve
        </h2>

        {/* 8 Cards Grid: 2 rows of 4 cards on desktop, 2x2 on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {industries.map((ind) => (
            <div
              key={ind.id}
              className="group flex flex-col items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer"
            >
              {/* Large Rounded Blue Square Badge with crisp pure white graphics, no shadows */}
              <div className="relative w-full aspect-square max-w-[150px] sm:max-w-[190px] lg:max-w-[220px] flex items-center justify-center rounded-xl sm:rounded-2xl bg-[#2b52ba] overflow-hidden p-3.5 sm:p-4 shadow-sm transition-transform duration-300 group-hover:scale-[1.03] group-hover:bg-[#22449e]">
                {ind.icon}
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
