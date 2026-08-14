import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Outfit, Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sojar Indusy - Industrial Manufacturing & B2B Procurement Platform",
  description:
    "Next-generation B2B manufacturing marketplace for precision fasteners, valves, flanges, and engineered hardware.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} ${outfit.variable} ${geist.variable} font-jakarta h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 selection:bg-[#024AE5] selection:text-white">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1 bg-white">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
