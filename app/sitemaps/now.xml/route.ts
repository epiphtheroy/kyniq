import { nowEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

// Now Playing (/now) child sitemap — full history of the live layer.
// The 48h fast lane is the separate /news-sitemap.xml.
export const revalidate = 600;
export const dynamic = "force-static";

export async function GET() {
  return xmlResponse(urlset(await nowEntries()));
}
