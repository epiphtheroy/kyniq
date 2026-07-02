import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Turbopack TS checker hangs on first build; verify types via tsc separately
    ignoreBuildErrors: true,
  },
  // TEMP (2026-07-02): CORS for /tmp-sql/* so the Supabase dashboard can fetch
  // our generated SQL payloads for in-browser execution. Remove after DB updates land.
  async headers() {
    return [
      {
        source: "/tmp-sql/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
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
