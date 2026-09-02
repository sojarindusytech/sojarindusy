import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
