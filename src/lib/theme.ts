export const THEME_COLORS = {
  background: "#ffffff",
  foreground: "#0f172a",
  primary: "#024AE5", // Requested Primary Blue
  primaryHover: "#013bb8",
  brandGreen: "#3C8B4F", // Requested Brand Green
  brandGreenHover: "#317240",
  secondary: "#f1f5f9",
  muted: "#f8fafc",
  border: "#e2e8f0",
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
} as const;

export type AvailableFont = "inter" | "jakarta" | "outfit" | "geist";

export interface FontOption {
  id: AvailableFont;
  name: string;
  className: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    className: "font-jakarta",
    description: "Modern Geometric & Corporate (Recommended)",
  },
  {
    id: "inter",
    name: "Inter",
    className: "font-inter",
    description: "Ultra-clean UI Standard",
  },
  {
    id: "outfit",
    name: "Outfit",
    className: "font-outfit",
    description: "Contemporary High-Tech",
  },
  {
    id: "geist",
    name: "Geist",
    className: "font-geist",
    description: "Precision Industrial & Code",
  },
];
