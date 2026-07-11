import { tvProgramVideoEntries, videoUrlset, xmlResponse } from "@/lib/sitemap-data";

export const revalidate = 3600;
export const dynamic = "force-static";

// A VIDEO sitemap: each /tv/[slug] broadcast is the main content of its watch
// page, declared with <video:video> so Google can discover and index it.
export async function GET() {
  return xmlResponse(videoUrlset(await tvProgramVideoEntries()));
}
