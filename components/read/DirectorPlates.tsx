import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cachedAtlasEligibility } from "@/lib/atlas";
import { Card, SectionHead } from "@/components/curious/ui";

/**
 * "More on {director}" — the dark bottom plate row shared by the director
 * article pages (2026-07-09; the director-side ReadPlates). Gathers every
 * director surface that actually exists (hub, life, start, next, locations,
 * honors, reception, takescore, theory) into thumbnail cards, then fills with
 * the director's top films. Self-contained: fetches by slug, cached daily.
 * `exclude` drops the card for the surface being read. Every link is gated on
 * the target page's own render condition — a 404 link is an invariant breach.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type PlateData = {
  director: string;
  films: { slug: string; title: string; year: number | null; backdrop_path: string | null; poster_path: string | null }[];
  facts: number; picks: number; next: number;
  hasLocations: boolean; honors: number; reception: number; takes: number;
};

const loadPlates = (slug: string) =>
  unstable_cache(
    async (): Promise<PlateData | null> => {
      const supabase = db();
      const { data: films } = await supabase
        .from("films")
        .select("id, slug, title, year, director, backdrop_path, poster_path")
        .eq("director_slug", slug).eq("visible", true).order("year");
      if (!films || films.length === 0) return null;
      const filmIds = films.map((f) => f.id as string);
      const [facts, picks, next, lineage, wd, reception, takes, atlas] = await Promise.all([
        supabase.from("director_facts").select("director_slug", { count: "exact", head: true }).eq("director_slug", slug),
        supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
        supabase.from("director_next").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
        supabase.from("film_lineage").select("id", { count: "exact", head: true }).in("film_id", filmIds),
        supabase.from("film_wd_honors").select("id", { count: "exact", head: true }).in("film_id", filmIds),
        supabase.from("film_reception").select("id", { count: "exact", head: true }).in("film_id", filmIds),
        supabase.from("takes").select("id, figure:figures!inner(film_id)", { count: "exact", head: true })
          .in("figure.film_id", filmIds).eq("status", "published").eq("is_invitation", false),
        cachedAtlasEligibility().catch(() => null),
      ]);
      return {
        director: (films[0].director as string) ?? slug.replace(/-/g, " "),
        films: films.map((f) => ({ slug: f.slug as string, title: f.title as string, year: f.year as number | null, backdrop_path: f.backdrop_path as string | null, poster_path: f.poster_path as string | null })),
        facts: facts.count ?? 0, picks: picks.count ?? 0, next: next.count ?? 0,
        hasLocations: !!atlas?.directors?.some((d: { slug: string }) => d.slug === slug),
        honors: (lineage.count ?? 0) + (wd.count ?? 0),
        reception: reception.count ?? 0,
        takes: takes.count ?? 0,
      };
    },
    ["director-plates-1", slug],
    { revalidate: 86400, tags: [`director:${slug}`] }
  )();

export default async function DirectorPlates({ slug, exclude }: { slug: string; exclude?: string }) {
  const data = await loadPlates(slug);
  if (!data) return null;
  const { director, films, facts, picks, next, hasLocations, honors, reception, takes } = data;

  type Plate = { key: string; href: string; tag: string; title: string };
  const plates: Plate[] = [];
  plates.push({ key: "hub", href: `/director/${slug}`, tag: "The director", title: `Everything on ${director} — films, readings, the map` });
  if (facts > 0 && exclude !== "life") plates.push({ key: "life", href: `/director/${slug}/life`, tag: "The life", title: `Who is ${director}? The researched moments, sourced` });
  if (picks > 0 && exclude !== "start") plates.push({ key: "start", href: `/director/${slug}/start`, tag: "Where to start", title: `Where to start with ${director} — the route, argued` });
  if (next > 0 && exclude !== "next") plates.push({ key: "next", href: `/director/${slug}/next`, tag: "Who's next", title: `After ${director}: the directors to watch next — and why` });
  if (hasLocations && exclude !== "locations") plates.push({ key: "locations", href: `/director/${slug}/locations`, tag: "On location", title: `Where does ${director} film? Every location, mapped` });
  if (honors > 0 && exclude !== "honors") plates.push({ key: "honors", href: `/director/${slug}/honors`, tag: "The record", title: `Every award ${director}'s films have won — counted and sourced` });
  if (reception > 0 && exclude !== "reception") plates.push({ key: "reception", href: `/director/${slug}/reception`, tag: "Reception", title: `What critics said about ${director}'s films — the record` });
  if (films.length >= 3 && exclude !== "takescore") plates.push({ key: "takescore", href: `/director/${slug}/takescore`, tag: "TakeScore", title: `Every ${director} film, scored — the TakeScore ranking` });
  if (takes > 0 && exclude !== "theory") plates.push({ key: "theory", href: `/director/${slug}/theory`, tag: "Through theory", title: `${director} through theory — the lenses his films answer to` });

  // Fill with the director's top films (backdrop-first), up to 10 cards total.
  const filmCards = films.filter((f) => f.backdrop_path).slice(0, Math.max(0, 10 - plates.length));
  const art = films.map((f) => f.backdrop_path).filter(Boolean) as string[];
  const shown = plates.slice(0, 10);
  if (shown.length + filmCards.length < 2) return null;

  return (
    <div className="cur rd-plates">
      <div className="cur-wrap">
        <SectionHead title={`More on ${director}`} count={`${shown.length + filmCards.length} places to go next`} />
        <div className="cur-grid">
          {shown.map((p, i) => (
            <Card
              key={p.key}
              href={p.href}
              film={{ slug, title: director, year: null, poster_path: films[0]?.poster_path ?? null, backdrop_path: art.length ? art[i % art.length] : null }}
              title={p.title}
              tag={p.tag}
            />
          ))}
          {filmCards.map((f) => (
            <Card
              key={f.slug}
              href={`/film/${f.slug}`}
              film={{ slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, backdrop_path: f.backdrop_path }}
              title={`${f.title}${f.year ? ` (${f.year})` : ""} — everything on the film`}
              tag="The film"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
