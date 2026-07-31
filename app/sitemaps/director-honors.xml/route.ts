import { cachedEntries, directorHonorsEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic"; // not prerendered — see xmlResponse()

export async function GET() {
  return xmlResponse(urlset(await cachedEntries("director-honors", directorHonorsEntries)));
}
