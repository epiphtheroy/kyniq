import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "Movies like — Metatake";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data: f } = await ogDb().from("films").select("title, year, backdrop_path, poster_path").eq("slug", slug).maybeSingle();
    if (!f) return ogFallback();
    return ogCard({ eyebrow: "Movies Like", title: `Movies like ${f.title as string}${f.year ? ` (${f.year})` : ""}`,
      subtitle: "The closest films by shared tropes and taste — ranked, with the evidence",
      backdropPath: f.backdrop_path as string | null, posterPath: f.poster_path as string | null });
  } catch { return ogFallback(); }
}
