import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DESKS, DESK_KEYS, mdToPlain } from "@/lib/desks";
import { cachedLocationsEligibility } from "@/lib/locations";
import { cachedLineageEligibility } from "@/lib/lineage";
import { filmMainIndexable } from "@/lib/filmGate";
import {
  filmUrl, takescoreFilmUrl, receptionUrl, misreadingsFilmUrl, filmLocationsUrl,
  filmLineageUrl, moviesLikeUrl, whereToUrl, tvUrl, filmCreditsUrl,
  questionUrl, directorUrl,
} from "@/lib/urls";
import { Card, SectionHead } from "@/components/curious/ui";
import BroadcastCard from "@/components/BroadcastCard";
import JoinCard from "@/components/conversion/JoinCard";

/**
 * "Keep exploring {film}" — the dark bottom plate block shared by every
 * single-film long-tail page (2026-07-08, reinforced 2026-07-13). Two jobs:
 *
 *   1. FUNNEL back to the film's MAIN page — the "About this film" CTA card
 *      (poster, a lead, and a prominent "read the full analysis" button, plus a
 *      direct "watch on Metatake TV" button when the film has a broadcast).
 *   2. OPEN every other read surface the film has — TakeScore, Reception, the
 *      misreadings article, Locations, Lineage, Movies-like, Where to Watch, the
 *      film's own TV broadcast, Credits, Curious questions, desk essays
 *      and Daily editions — as ScreenRant-style thumbnail cards.
 *
 * Self-contained: fetches by slug, cached an hour, styled by curious.css (the
 * `.cur` family) with the block chrome inlined so a host page needs only that
 * one stylesheet. Every surface is GATED on the exact publication bar its own
 * page/robots use, so a card never points at a 404 or a noindex stub — this is
 * navigation, never duplicated body content, and it stays SEO-safe.
 *
 * `exclude` drops the card (and, for surfaces, is a no-op elsewhere) for the
 * surface being read: "takescore" | "reception" | "misreadings" | "locations" |
 * "lineage" | "movies-like" | "whereto" | "tv" | "credits" |
 * "desk:<key>" | "q:<slug>". `artPaths` (TMDB backdrop paths) vary the card
 * thumbnails so the row isn't one repeated backdrop.
 */

const IMG = "https://image.tmdb.org/t/p";
const PLATE_CAP = 14;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Plain, word-boundary truncation for the overview lead (overviews are prose,
 *  not markdown, so no token/mark stripping is needed). */
function clip(text: string | null | undefined, max = 200): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:.!?—–-]+$/, "") + "…";
}

type PlateFilm = {
  id: string; title: string; slug: string; year: number | null;
  poster_path: string | null; backdrop_path: string | null;
  overview: string | null; director: string | null; director_slug: string | null;
  is_analyzed: boolean | null;
};
type PlateGates = {
  takescore: boolean; locations: number | null; lineage: boolean;
  reception: boolean; moviesLike: boolean; tv: boolean;
};
type PlateData = {
  film: PlateFilm;
  gates: PlateGates;
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
        .select("id, title, slug, year, poster_path, backdrop_path, overview, director, director_slug, is_analyzed, visible")
        .eq("slug", slug)
        .maybeSingle<PlateFilm & { visible: boolean }>();
      if (!film) return null;
      // Render the footer plates whenever the film's MAIN page is indexable — that
      // is Tier-1 (visible) AND promoted Tier-2 catalog records (visible=false but
      // past the consolidation gate). The old `!film.visible` gate silently dropped
      // this whole "keep exploring" block on every promoted Tier-2 subpage; the CTA
      // funnels back to the main page, so gating on the main page's own indexability
      // keeps them in lockstep. Deliberately-hidden analyzed films stay excluded.
      if (!(await filmMainIndexable(film.slug, { visible: film.visible }))) return null;

      const [
        { data: qRows }, { data: eRows }, { data: dRows },
        tsRes, locElig, linElig, honorRes, recRes, affRes, tvRes,
      ] = await Promise.all([
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
        // ── surface gates: each mirrors that page's own publication bar ──
        supabase.rpc("takescore_for_slugs", { p_slugs: [slug] }),
        cachedLocationsEligibility(),
        cachedLineageEligibility(),
        supabase.from("film_wd_honors").select("id", { count: "exact", head: true }).eq("film_id", film.id),
        supabase.from("film_reception").select("id", { count: "exact", head: true }).eq("film_id", film.id),
        supabase.from("film_affinities").select("film_id", { count: "exact", head: true }).eq("film_id", film.id),
        supabase.from("tv_programs").select("slug", { count: "exact", head: true }).eq("slug", slug).eq("status", "published"),
      ]);

      const seenMode = new Set<string>();
      const desks: PlateData["desks"] = [];
      for (const e of (eRows ?? []) as { mode: string; title: string }[]) {
        if (seenMode.has(e.mode)) continue;
        seenMode.add(e.mode);
        const k = DESK_KEYS.find((dk) => DESKS[dk].mode === e.mode);
        if (k) desks.push({ key: k, label: DESKS[k].label, title: mdToPlain(e.title) });
      }

      const gates: PlateGates = {
        takescore: (((tsRes.data ?? []) as { slug: string; ts: number }[]).length) > 0,
        locations: locElig.films.find((f) => f.slug === slug)?.n ?? null,
        lineage: linElig.films.some((f) => f.slug === slug),
        reception: (honorRes.count ?? 0) > 0 || (recRes.count ?? 0) > 0,
        moviesLike: (affRes.count ?? 0) >= 3,
        tv: (tvRes.count ?? 0) > 0,
      };

      return {
        film: {
          id: film.id, title: film.title, slug: film.slug, year: film.year,
          poster_path: film.poster_path, backdrop_path: film.backdrop_path,
          overview: film.overview, director: film.director, director_slug: film.director_slug,
          is_analyzed: film.is_analyzed,
        },
        gates,
        questions: (qRows ?? []) as PlateData["questions"],
        desks,
        daily: (dRows ?? []) as PlateData["daily"],
      };
    },
    ["read-plates-3", slug], // key bumped (3) when the gate moved from film.visible to filmMainIndexable (promoted Tier-2 now render; stale null results must not persist)
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
  const { film, gates, questions, desks, daily } = data;
  const yr = film.year ? ` (${film.year})` : "";

  type Plate = { key: string; href: string; tag: string; title: string };
  const plates: Plate[] = [];
  // The film's own read layers, strongest first (cap trims the tail). Each is
  // gated so it never links to a page that would 404 or noindex.
  if (gates.takescore && exclude !== "takescore")
    plates.push({ key: "takescore", href: takescoreFilmUrl(film.slug), tag: "TakeScore", title: `The TakeScore verdict on ${film.title}` });
  if (gates.reception && exclude !== "reception")
    plates.push({ key: "reception", href: receptionUrl(film.slug), tag: "Reception", title: `How ${film.title} was received — reviews & honors` });
  if (film.is_analyzed && exclude !== "misreadings")
    plates.push({ key: "misreadings", href: misreadingsFilmUrl(film.slug), tag: "Strong Misreadings", title: `${film.title}, read against the grain — the misreadings` });
  if (gates.locations != null && exclude !== "locations")
    plates.push({ key: "locations", href: filmLocationsUrl(film.slug), tag: "On Location", title: `Where was ${film.title} filmed? ${gates.locations} real places, mapped` });
  if (gates.lineage && exclude !== "lineage")
    plates.push({ key: "lineage", href: filmLineageUrl(film.slug), tag: "Lineage", title: `${film.title} in the canon — awards, lists & lineage` });
  if (gates.moviesLike && exclude !== "movies-like")
    plates.push({ key: "movies-like", href: moviesLikeUrl(film.slug), tag: "Similar Films", title: `Movies like ${film.title}, ranked by shared tropes` });
  if (exclude !== "whereto")
    plates.push({ key: "whereto", href: whereToUrl(film.slug), tag: "Where to Watch", title: `Where to watch ${film.title} — free options & every service` });
  // NB: no "Metatake TV" plate — the film's broadcast now gets the playable
  // BroadcastCard below (one TV affordance, not two). See BroadcastCard render.
  if (exclude !== "credits")
    plates.push({ key: "credits", href: filmCreditsUrl(film.slug), tag: "Credits", title: `Who made ${film.title}? The crew, credit by credit` });
  for (const q of questions) {
    const k = `q:${q.slug}`;
    if (k === exclude) continue;
    plates.push({ key: k, href: questionUrl(film.slug, q.slug), tag: q.question_type ?? "Curious", title: (q.title_spoiler && q.display_title) ? q.display_title : q.title });
    if (plates.length >= PLATE_CAP) break;
  }
  for (const d of desks) {
    const k = `desk:${d.key}`;
    if (k === exclude) continue;
    plates.push({ key: k, href: `/film/${film.slug}/${d.key}`, tag: d.label, title: d.title });
    if (plates.length >= PLATE_CAP) break;
  }
  for (const d of daily) {
    plates.push({ key: `daily:${d.slug}`, href: `/blog/${d.slug}`, tag: "The Daily", title: d.title && d.title.toLowerCase() !== "between film and the world" ? d.title : `The ${d.edition_date} edition` });
  }
  const shown = plates.slice(0, PLATE_CAP);

  // Rotate thumbnails through the gallery picks so the row isn't one repeated backdrop.
  const art = artPaths.length ? artPaths : ([film.backdrop_path].filter(Boolean) as string[]);

  const lead = clip(film.overview, 210)
    || `The full Metatake reading of ${film.title}${yr} — close readings, figures and tropes, its standing in the canon, filming locations and where to watch, all gathered on one page.`;

  return (
    <>
      {/* Playable broadcast — the film's METATAKE TV essay, click-to-play (no
          <iframe> until click, so it stays clear of the video-indexing flag).
          Replaces the old "Watch on Metatake TV" link plate + CTA button. */}
      {gates.tv ? (
        <div className="cur-wrap">
          <BroadcastCard
            program={film.slug}
            watchHref={tvUrl(film.slug)}
            poster={film.backdrop_path}
            title={`Watch ${film.title}${yr} on METATAKE TV`}
            theme={`A chapter-by-chapter audiovisual reading of ${film.title} — figures, misreadings, reception and its map, played over the film's images.`}
          />
        </div>
      ) : null}
    <div
      className="cur rd-plates"
      style={{ minHeight: 0, marginTop: 48, borderTop: "3px solid var(--cur-accent)", padding: "4px 0 46px" }}
    >
      <div className="cur-wrap">
        {/* ── About this film — the funnel back to the main page ── */}
        <div className="rd-cta">
          {film.poster_path ? (
            <Link href={filmUrl(film.slug)} className="rd-cta__poster" aria-label={film.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}/w154${film.poster_path}`} alt={`${film.title} poster`} width={84} height={126} loading="lazy" />
            </Link>
          ) : null}
          <div className="rd-cta__body">
            <span className="rd-cta__tag">About this film</span>
            <h2><Link href={filmUrl(film.slug)}>{film.title}{yr}</Link></h2>
            <p>{lead}</p>
            {film.director && film.director_slug ? (
              <p className="rd-cta__by">Directed by <Link href={directorUrl(film.director_slug)}>{film.director}</Link></p>
            ) : null}
            <div className="rd-cta__btns">
              <Link className="rd-cta__btn" href={filmUrl(film.slug)}>Read the full Metatake analysis of {film.title} →</Link>
            </div>
          </div>
        </div>

        {/* ── Join invitation — a distinct light card on the dark band, set in its
            own row so it reads as an intentional invitation, not a broken plate ── */}
        <div style={{ margin: "28px 0" }}>
          <JoinCard variant="film" source="readplates" />
        </div>

        {/* ── Keep exploring: every other surface the film has ── */}
        {shown.length >= 1 ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
    </>
  );
}
