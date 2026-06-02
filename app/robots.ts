import type { MetadataRoute } from "next";

/**
 * robots.txt — SPEC §8.3
 * Default posture: maximize exposure — allow both retrieval and training crawlers.
 * If later you want to protect content from training, switch GPTBot / ClaudeBot /
 * Google-Extended / CCBot lines to disallow; never block the retrieval bots.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kyniq.io";

  return {
    rules: [
      // Default: allow all
      {
        userAgent: "*",
        allow: "/",
      },
      // AI retrieval / search bots (must stay allowed)
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
      },
      {
        userAgent: "Claude-SearchBot",
        allow: "/",
      },
      {
        userAgent: "Claude-User",
        allow: "/",
      },
      // AI training bots (allow for max exposure; flip to Disallow to opt out)
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
      {
        userAgent: "CCBot",
        allow: "/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
