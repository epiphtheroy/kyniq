import { SITE_INDEXABLE } from "@/lib/seo";
import { sitemapindex, xmlResponse } from "@/lib/sitemap-data";

// Sitemap INDEX — points at per-section child sitemaps (app/sitemaps/*.xml) so
// Search Console reports indexed counts per section. Data lives in
// lib/sitemap-data.ts.
export const revalidate = 3600;
export const dynamic = "force-static";

const SECTIONS = [
  "core",
  "films",
  "figures",
  "qa",
  "movies-like",
  "tropes",
  "takes",
  "credits",
  "directors",
  "concepts",
  "profiles",
  "whereto",
  "genres",
  "theorists",
];

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const sections = SITE_INDEXABLE ? SECTIONS : ["core"];
  return xmlResponse(sitemapindex(sections.map((s) => `${siteUrl}/sitemaps/${s}.xml`)));
}
