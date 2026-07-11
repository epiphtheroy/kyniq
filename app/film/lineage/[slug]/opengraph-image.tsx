import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "Awards, canons & honors — Metatake";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = ogDb();
    const { data: f } = await db.from("films").select("id, title, year, backdrop_path, poster_path").eq("slug", slug).maybeSingle();
    if (!f) return ogFallback();
    const { count } = await db.from("film_lineage").select("id", { count: "exact", head: true }).eq("film_id", f.id);
    return ogCard({ eyebrow: "Awards, Canons & Honors", title: `${f.title as string}${f.year ? ` (${f.year})` : ""}`,
      subtitle: "Every award, canon and honors listing — the complete record",
      backdropPath: f.backdrop_path as string | null, posterPath: f.poster_path as string | null,
      badges: count ? [{ label: "listings", value: String(count), tone: "score" as const }] : [] });
  } catch { return ogFallback(); }
}
