import { directorTheoryEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic"; // not prerendered — see xmlResponse()

export async function GET() {
  return xmlResponse(urlset(await directorTheoryEntries()));
}
