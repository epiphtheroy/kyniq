import { cachedEntries, directorReceptionEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic"; // not prerendered — see xmlResponse()

export async function GET() {
  return xmlResponse(urlset(await cachedEntries("director-reception", directorReceptionEntries)));
}
