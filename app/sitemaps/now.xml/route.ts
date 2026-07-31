import { cachedEntries, nowEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

// Now Playing (/now) child sitemap — full history of the live layer.
// The 48h fast lane is the separate /news-sitemap.xml.
export const dynamic = "force-dynamic"; // not prerendered — see xmlResponse()

export async function GET() {
  return xmlResponse(urlset(await cachedEntries("now", nowEntries)));
}
