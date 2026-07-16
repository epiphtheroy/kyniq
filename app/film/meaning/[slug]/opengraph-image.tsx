import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Strong Misreadings on Metatake";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = ogDb();
    const { data: film } = await db.from("films")
      .select("id, title, year, backdrop_path, poster_path").eq("slug", slug).maybeSingle();
    if (!film) return ogFallback();
    const { data: figRows } = await db.from("figures").select("id").eq("film_id", film.id).eq("status", "approved");
    const figIds = ((figRows ?? []) as { id: string }[]).map((f) => f.id);
    let n = 0;
    if (figIds.length) {
      const { count } = await db.from("takes").select("id", { count: "exact", head: true })
        .in("figure_id", figIds).eq("status", "published").eq("is_invitation", false);
      n = count ?? 0;
    }
    return ogCard({
      eyebrow: "Strong Misreadings",
      title: `Strong Misreadings of ${film.title}${film.year ? ` (${film.year})` : ""}`,
      subtitle: "Deliberate over-readings — each one an argument, not a summary",
      backdropPath: film.backdrop_path as string | null,
      posterPath: film.poster_path as string | null,
      badges: n ? [{ label: n === 1 ? "reading" : "readings", value: String(n), tone: "hot" as const }] : [],
    });
  } catch { return ogFallback(); }
}
