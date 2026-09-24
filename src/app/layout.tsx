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
  title: "Sojar Solutions - Industrial Manufacturing & B2B Procurement Platform",
  description:
    "Next-generation B2B manufacturing marketplace for precision fasteners, valves, flanges, and engineered hardware.",
};

import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { Footer } from "@/components/common/Footer";
import { NavigationProgressBar } from "@/components/common/NavigationProgressBar";

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
      <head>
        <link rel="preconnect" href="https://maps.google.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://maps.google.com" />
        <link rel="dns-prefetch" href="https://maps.gstatic.com" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-slate-900 font-sans selection:bg-[#024AE5] selection:text-white">
        <NavigationProgressBar />
        <ThemeProvider>
          <CartProvider>
            <GlobalHeader />
            <main className="flex-1 bg-white">{children}</main>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </ThemeProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
