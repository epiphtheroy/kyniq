import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { DESKS, DESK_KEYS, type DeskKey } from "@/lib/desks";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A Metatake desk essay";

export default async function Image({ params }: { params: Promise<{ slug: string; desk: string }> }) {
  try {
    const { slug, desk } = await params;
    if (!DESK_KEYS.includes(desk as DeskKey)) return ogFallback();
    const meta = DESKS[desk as DeskKey];
    const db = ogDb();
    const { data: film } = await db.from("films")
      .select("id, title, year, backdrop_path, poster_path").eq("slug", slug).maybeSingle();
    if (!film) return ogFallback();
    const { data: essay } = await db.from("essays")
      .select("title")
      .eq("film_id", film.id).eq("mode", meta.mode).eq("lang", "en").eq("status", "verified").maybeSingle();

    const title = (essay?.title as string) || `${film.title}${film.year ? ` (${film.year})` : ""} — ${meta.deskName}`;
    return ogCard({
      eyebrow: `Curious · ${meta.deskName}`,
      title,
      subtitle: `${film.title}${film.year ? ` (${film.year})` : ""} — on Metatake`,
      backdropPath: film.backdrop_path as string | null,
      posterPath: film.poster_path as string | null,
    });
  } catch { return ogFallback(); }
}
