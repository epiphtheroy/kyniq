import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Reviews & Afterlife on Metatake";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = ogDb();
    const { data: film } = await db.from("films")
      .select("id, title, year, backdrop_path, poster_path").eq("slug", slug).maybeSingle();
    if (!film) return ogFallback();
    const [{ data: rcp }, { data: ev }, honRes] = await Promise.all([
      db.from("film_reception").select("kind, review_year").eq("film_id", film.id),
      db.from("film_release_events").select("event_date").eq("film_id", film.id),
      db.from("film_wd_honors").select("id", { count: "exact", head: true }).eq("film_id", film.id),
    ]);
    const reviews = ((rcp ?? []) as { kind: string }[]).filter((r) => r.kind === "criticism").length;
    const years = [
      ...((rcp ?? []) as { review_year: number | null }[]).map((r) => r.review_year ?? 0),
      ...((ev ?? []) as { event_date: string }[]).map((e) => Number(e.event_date.slice(0, 4))),
    ].filter((y) => y > 1880);
    const y0 = years.length ? Math.min(...years) : film.year;
    const y1 = years.length ? Math.max(...years) : film.year;
    const honors = honRes.count ?? 0;

    const badges = [
      reviews ? { label: reviews === 1 ? "review" : "reviews", value: String(reviews), tone: "plain" as const } : null,
      honors ? { label: honors === 1 ? "honor" : "honors", value: String(honors), tone: "score" as const } : null,
      y0 && y1 && y1 > y0 ? { label: "years", value: `${y0}–${y1}`, tone: "plain" as const } : null,
    ].filter(Boolean) as { label: string; value: string; tone: "score" | "plain" }[];

    return ogCard({
      eyebrow: honors || reviews ? "Reviews & Afterlife" : "The Afterlife",
      title: `${film.title}${film.year ? ` (${film.year})` : ""}`,
      subtitle: "What critics said, and everything since — year by year",
      backdropPath: film.backdrop_path as string | null,
      posterPath: film.poster_path as string | null,
      badges,
    });
  } catch { return ogFallback(); }
}
