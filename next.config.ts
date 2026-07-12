import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Turbopack TS checker hangs on first build; verify types via tsc separately
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
