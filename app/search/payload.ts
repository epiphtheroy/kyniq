/**
 * app/search/payload.ts — everything /search needs for one query, server side.
 *
 * Split out of page.tsx on 2026-08-04 when the results moved to a client fetch
 * (see OmniResults.tsx for why). The page renders the shell; /api/search/omni
 * calls loadOmniPayload; both live on the server, so the Supabase anon client,
 * the entity-card queries and the Data Cache wrapper all stay here.
 */
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { runSearch } from "@/lib/search";
import { attachKwic, kwic } from "@/lib/kwic";
import { TMDB_IMG, type SearchHit } from "@/lib/search-shared";
import { displayTs } from "@/lib/cinecodex_dims";

const IMG = TMDB_IMG;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/* ------------------------------------------------------------- entity card */

export type FilmCard = {
  type: "film"; slug: string; title: string; year: number | null; director: string | null;
  director_slug: string | null; overview: string | null; poster_path: string | null;
  backdrop_path: string | null; runtime: number | null; genres: string[] | null;
  takescore: number | null; rank: number | null; rank_total: number | null;
  imdb: number | null; rt: number | null; metascore: number | null;
  honors: number; lineage: number; stills: { url: string; thumb: string }[];
};
export type DirectorCard = {
  type: "director"; slug: string; name: string; profile_path: string | null;
  place_of_birth: string | null; birthday: string | null; bio: string | null;
  films: { slug: string; title: string; year: number | null; poster_path: string | null }[];
};
export type TheoristCard = {
  type: "theorist"; slug: string; name: string; blurb: string | null;
  essays: { film_slug: string; desk_key: string; essay_title: string; poster_path: string | null }[];
};
export type EntityCard = FilmCard | DirectorCard | TheoristCard | null;

async function loadEntityCard(hit: SearchHit | undefined): Promise<EntityCard> {
  if (!hit) return null;
  const sb = db();
  try {
    if (hit.kind === "film") {
      const { data: f } = await sb.from("films")
        .select("id, slug, title, year, director, director_slug, overview, poster_path, backdrop_path, runtime, genres")
        .eq("slug", hit.slug).maybeSingle();
      if (!f) return null;
      const [codexRes, ratRes, honRes, stillRes, linRes] = await Promise.all([
        sb.rpc("cinecodex_for", { p_slug: f.slug }),
        sb.from("film_ratings").select("imdb_rating, rt_tomatometer, metascore").eq("film_id", f.id).maybeSingle(),
        sb.from("film_wd_honors").select("id", { count: "exact", head: true }).eq("film_id", f.id),
        sb.from("media").select("url, thumbnail_url").eq("entity_type", "film").eq("entity_id", f.id)
          .eq("kind", "image").eq("status", "published").order("position").limit(10),
        sb.from("film_lineage").select("id", { count: "exact", head: true }).eq("film_id", f.id),
      ]);
      const cx = (codexRes.data ?? null) as { u?: number; rank?: number; rank_total?: number } | null;
      const rat = ratRes.data as { imdb_rating: number | null; rt_tomatometer: number | null; metascore: number | null } | null;
      return {
        type: "film", slug: f.slug, title: f.title, year: f.year, director: f.director,
        director_slug: f.director_slug, overview: f.overview, poster_path: f.poster_path,
        backdrop_path: f.backdrop_path, runtime: f.runtime, genres: f.genres,
        takescore: cx?.u != null ? displayTs(cx.u) : null,
        rank: cx?.rank ?? null, rank_total: cx?.rank_total ?? null,
        imdb: rat?.imdb_rating ?? null, rt: rat?.rt_tomatometer ?? null, metascore: rat?.metascore ?? null,
        honors: honRes.count ?? 0,
        lineage: linRes.count ?? 0,
        stills: ((stillRes.data ?? []) as { url: string; thumbnail_url: string }[])
          .map((s) => ({ url: s.url, thumb: s.thumbnail_url })),
      };
    }
    if (hit.kind === "director") {
      const { data: d } = await sb.from("directors")
        .select("slug, name, profile_path, place_of_birth, birthday, bio").eq("slug", hit.slug).maybeSingle();
      if (!d) return null;
      const { data: films } = await sb.from("films")
        .select("slug, title, year, poster_path").eq("director_slug", d.slug)
        .not("poster_path", "is", null).order("year", { ascending: false }).limit(12);
      return { type: "director", ...d, films: (films ?? []) as DirectorCard["films"] };
    }
    if (hit.kind === "theorist") {
      const { data: t } = await sb.from("theorists").select("slug, name, blurb").eq("slug", hit.slug).maybeSingle();
      if (!t) return null;
      const { data: eel } = await sb.from("essay_entity_links")
        .select("film_slug, desk_key, essay_title").eq("entity_type", "theorist").eq("entity_slug", t.slug).limit(6);
      const links = (eel ?? []) as { film_slug: string; desk_key: string; essay_title: string }[];
      const slugs = [...new Set(links.map((l) => l.film_slug))];
      const posters = new Map<string, string | null>();
      if (slugs.length) {
        const { data: fs } = await sb.from("films").select("slug, poster_path").in("slug", slugs);
        for (const f of (fs ?? []) as { slug: string; poster_path: string | null }[]) posters.set(f.slug, f.poster_path);
      }
      const seen = new Set<string>();
      const essays = links.filter((l) => {
        const k = `${l.film_slug}/${l.desk_key}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      }).map((l) => ({ ...l, poster_path: posters.get(l.film_slug) ?? null }));
      return { type: "theorist", ...t, essays };
    }
  } catch { /* the card is garnish — results still render */ }
  return null;
}

/* ------------------------------------------------------------------ payload */

export type OmniPayload = {
  hits: SearchHit[]; semantic: boolean; took: number;
  card: EntityCard; cardKey: string | null;
  strip: { href: string; src: string; label: string }[];
  related: string[];
};

/* payload: everything a query needs, one Data Cache entry.
   Cold query: engine + (KWIC ∥ leap ∥ entity card) in parallel. Warm query
   (anyone searched it in the last hour): served from the Data Cache in ~ms. */
export const loadOmniPayload = (term: string): Promise<OmniPayload> =>
  unstable_cache(async (): Promise<OmniPayload> => {
    const result = await runSearch(term, { limit: 80 });
    let hits = result.hits;

    const essayHits = hits.filter((h) => h.kind === "essay" && h.film_slug);
    const readingHits = hits.filter((h) => h.kind === "reading").slice(0, 12);
    const cardHit = hits.slice(0, 6).find((h) => ["film", "director", "theorist"].includes(h.kind));

    // The three enrichments are independent — run them concurrently.
    const [kwByKey, leapBySlug, card] = await Promise.all([
      (async () => {
        if (!essayHits.length) return new Map<string, string | null>();
        try {
          const kw = await attachKwic(db(), essayHits.map((h) => ({ film_slug: h.film_slug as string, desk_key: h.slug, excerpt: h.sub })), [term]);
          return new Map(kw.map((k) => [`${k.film_slug}/${k.desk_key}`, k.excerpt]));
        } catch { return new Map<string, string | null>(); }
      })(),
      (async () => {
        if (!readingHits.length) return new Map<string, string>();
        try {
          const { data } = await db().from("takes")
            .select("leap, figure:figures!inner(slug)")
            .in("figure.slug", readingHits.map((h) => h.slug))
            .eq("status", "published").limit(40);
          const m = new Map<string, string>();
          for (const r of (data ?? []) as unknown as { leap: string | null; figure: { slug: string } }[]) {
            if (r.figure?.slug && r.leap && !m.has(r.figure.slug)) m.set(r.figure.slug, r.leap);
          }
          return m;
        } catch { return new Map<string, string>(); }
      })(),
      loadEntityCard(cardHit),
    ]);

    hits = hits.map((h) => {
      if (h.kind === "essay" && h.film_slug) {
        const kw = kwByKey.get(`${h.film_slug}/${h.slug}`);
        if (kw) return { ...h, sub: kw };
      }
      if (h.kind === "reading" && leapBySlug.has(h.slug)) {
        return { ...h, sub: kwic(leapBySlug.get(h.slug)!, [term], 150) };
      }
      return h;
    });

    const hitKey = (h: SearchHit) => `${h.kind}:${h.slug}:${h.film_slug ?? ""}`;
    const cardKey = cardHit ? hitKey(cardHit) : null;

    const strip: { href: string; src: string; label: string }[] = [];
    if (card?.type === "film") for (const s of card.stills.slice(0, 8)) strip.push({ href: `/film/${card.slug}/gallery`, src: s.thumb, label: card.title });
    const seenPoster = new Set<string>();
    for (const h of hits) {
      if (!h.poster || seenPoster.has(h.poster)) continue;
      if (card?.type === "film" && hitKey(h) === cardKey) continue;
      seenPoster.add(h.poster);
      strip.push({ href: h.href, src: `${IMG}/w185${h.poster}`, label: h.title });
      if (strip.length >= 14) break;
    }

    const related = [...new Set(hits
      .filter((h) => ["director", "theorist", "idea", "trope", "tradition", "movement"].includes(h.kind))
      .map((h) => h.title)
      .filter((t) => t.toLowerCase() !== term.toLowerCase()))].slice(0, 8);

    return { hits, semantic: result.semantic, took: result.took, card, cardKey, strip, related };
    // 600s was tuned for a person retyping a query. The actual caller is a
    // rotating-residential-proxy sweep (measured 2026-08-03: 18,954 req/day,
    // 17.5% of function volume, every sampled /24 distinct and on a different
    // continent — so nothing can be blocked, only made cheap). Terms DO repeat:
    // in one 6h12m window /search took ~4,900 requests while search_all logged
    // 2,613 calls, i.e. the cache already absorbed ~47%. It was expiring between
    // passes. An hour raises that without pretending the corpus is frozen — new
    // films and /now pieces still surface the same day, and the nav typeahead
    // keeps its own 10-minute in-process cache in lib/search.ts.
  }, ["omni-payload-1", term.toLowerCase()], { revalidate: 3600 })();
