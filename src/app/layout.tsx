import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalHeader } from "@/components/common/GlobalHeader";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "react-hot-toast";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const skodaPro = localFont({
  src: "../../public/assets/fonts/SkodaProLight.ttf",
  variable: "--font-skoda",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sojar Indusy - Industrial Manufacturing & B2B Procurement Platform",
  description:
    "Next-generation B2B manufacturing marketplace for precision fasteners, valves, flanges, and engineered hardware.",
};

import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/storefront/CartDrawer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${skodaPro.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 font-sans selection:bg-[#024AE5] selection:text-white">
        <ThemeProvider>
          <CartProvider>
            <GlobalHeader />
            <main className="flex-1 bg-white">{children}</main>
            <CartDrawer />
          </CartProvider>
        </ThemeProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
