import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Invoice PDFs read Roboto from disk at render time; make sure it ships with the route.
  outputFileTracingIncludes: {
    "/api/invoices/[id]/pdf": ["./src/assets/fonts/**"],
    "/api/quotes/[id]/pdf": ["./src/assets/fonts/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "egtimyfpruzbmscnglxs.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/products/:category+/:slug",
        destination: "/products/:slug",
      },
      {
        source: "/categories/:path+/:slug",
        destination: "/categories/:slug",
      },
    ];
  },
};

export default nextConfig;
