import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DESKS, DESK_KEYS, mdToPlain } from "@/lib/desks";
import { Card, SectionHead } from "@/components/curious/ui";

/**
 * "More on {film}" — the dark bottom plate row shared by the reading pages
 * (2026-07-08). Gathers every read surface the film has (film hub, TakeScore,
 * the misreadings article, Curious questions, desk essays, Daily editions)
 * into ScreenRant-style thumbnail cards. Self-contained: fetches by slug,
 * cached an hour. `exclude` drops the card for the surface being read
 * ("misreadings" | "desk:<key>" | "q:<slug>"). `artPaths` (TMDB backdrop
 * paths, e.g. leftover gallery picks) vary the card thumbnails.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type PlateData = {
  film: { id: string; title: string; slug: string; year: number | null; poster_path: string | null; backdrop_path: string | null; is_analyzed: boolean | null };
  questions: { slug: string; title: string; display_title: string | null; title_spoiler: boolean | null; question_type: string | null }[];
  desks: { key: string; label: string; title: string }[];
  daily: { slug: string; title: string; edition_date: string }[];
};

const loadPlates = (slug: string) =>
  unstable_cache(
    async (): Promise<PlateData | null> => {
      const supabase = db();
      const { data: film } = await supabase
        .from("films")
        .select("id, title, slug, year, poster_path, backdrop_path, is_analyzed, visible")
        .eq("slug", slug)
        .maybeSingle<PlateData["film"] & { visible: boolean }>();
      if (!film || !film.visible) return null;
      const [{ data: qRows }, { data: eRows }, { data: dRows }] = await Promise.all([
        supabase.from("questions")
          .select("slug, title, display_title, title_spoiler, question_type")
          .eq("film_id", film.id).eq("status", "published")
          .order("published_at", { ascending: false }).limit(4),
        supabase.from("essays")
          .select("mode, title")
          .eq("film_id", film.id).eq("lang", "en").eq("status", "verified")
          .order("published_at", { ascending: false, nullsFirst: false }),
        supabase.from("posts")
          .select("slug, title, edition_date")
          .eq("status", "published").contains("entries", JSON.stringify([{ film_slug: slug }]))
          .order("edition_date", { ascending: false }).limit(2),
      ]);
      const seenMode = new Set<string>();
      const desks: PlateData["desks"] = [];
      for (const e of (eRows ?? []) as { mode: string; title: string }[]) {
        if (seenMode.has(e.mode)) continue;
        seenMode.add(e.mode);
        const k = DESK_KEYS.find((dk) => DESKS[dk].mode === e.mode);
        if (k) desks.push({ key: k, label: DESKS[k].label, title: mdToPlain(e.title) });
      }
      return {
        film: { id: film.id, title: film.title, slug: film.slug, year: film.year, poster_path: film.poster_path, backdrop_path: film.backdrop_path, is_analyzed: film.is_analyzed },
        questions: (qRows ?? []) as PlateData["questions"],
        desks,
        daily: (dRows ?? []) as PlateData["daily"],
      };
    },
    ["read-plates-1", slug],
    { revalidate: 3600, tags: [`film:${slug}`] }
  )();

export default async function ReadPlates({
  slug,
  exclude,
  artPaths = [],
}: {
  slug: string;
  exclude?: string;
  artPaths?: string[];
}) {
  const data = await loadPlates(slug);
  if (!data) return null;
  const { film, questions, desks, daily } = data;

  type Plate = { key: string; href: string; tag: string; title: string };
  const plates: Plate[] = [];
  plates.push({ key: "hub", href: `/film/${film.slug}`, tag: "The film", title: `Everything on ${film.title}${film.year ? ` (${film.year})` : ""}` });
  plates.push({ key: "takescore", href: `/takescore/film/${film.slug}`, tag: "TakeScore", title: `The TakeScore verdict on ${film.title}` });
  if (film.is_analyzed && exclude !== "misreadings") {
    plates.push({ key: "misreadings", href: `/film/${film.slug}/misreadings`, tag: "Strong Misreadings", title: `${film.title}, read against the grain — the misreadings article` });
  }
  for (const q of questions) {
    const k = `q:${q.slug}`;
    if (k === exclude) continue;
    plates.push({ key: k, href: `/film/${film.slug}/q/${q.slug}`, tag: q.question_type ?? "Curious", title: (q.title_spoiler && q.display_title) ? q.display_title : q.title });
    if (plates.length >= 12) break;
  }
  for (const d of desks) {
    const k = `desk:${d.key}`;
    if (k === exclude) continue;
    plates.push({ key: k, href: `/film/${film.slug}/${d.key}`, tag: d.label, title: d.title });
    if (plates.length >= 12) break;
  }
  for (const d of daily) {
    plates.push({ key: `daily:${d.slug}`, href: `/blog/${d.slug}`, tag: "The Daily", title: d.title && d.title.toLowerCase() !== "between film and the world" ? d.title : `The ${d.edition_date} edition` });
  }
  const shown = plates.slice(0, 10);
  if (shown.length < 2) return null;

  // Rotate thumbnails through the gallery picks so the row isn't one repeated backdrop.
  const art = artPaths.length ? artPaths : [film.backdrop_path].filter(Boolean) as string[];

  return (
    <div className="cur rd-plates">
      <div className="cur-wrap">
        <SectionHead title={`More on ${film.title}`} count={`${shown.length} places to go next`} />
        <div className="cur-grid">
          {shown.map((p, i) => (
            <Card
              key={p.key}
              href={p.href}
              film={{ slug: film.slug, title: film.title, year: film.year, poster_path: film.poster_path, backdrop_path: art.length ? art[i % art.length] : film.backdrop_path }}
              title={p.title}
              tag={p.tag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
