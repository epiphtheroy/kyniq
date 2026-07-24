import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Turbopack TS checker hangs on first build; verify types via tsc separately
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Apple requires the AASA file to be served as JSON (Universal Links)
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "content-type", value: "application/json" }],
      },
    ];
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
