import { tvProgramEntries, urlset, xmlResponse } from "@/lib/sitemap-data";

export const revalidate = 3600;
export const dynamic = "force-static";

export async function GET() {
  return xmlResponse(urlset(await tvProgramEntries()));
}
