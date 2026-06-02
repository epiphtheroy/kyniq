import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap — SPEC §8.5
 * For Mission 0, returns only the root `/`. Future missions will query the DB
 * for published films, questions, director hubs, and public profiles.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kyniq.io";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
