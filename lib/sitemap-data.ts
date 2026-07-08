import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import {
  SITE_INDEXABLE,
  INDEX_COHORT_READINGS,
  INDEX_COHORT_TROPES,
  INDEX_COHORT_FIGURES,
  INDEX_COHORT_CREW,
  INDEX_COHORT_CATALOG,
  INDEX_COHORT_FILM_LOCATIONS,
  INDEX_COHORT_FILM_HONORS,
  INDEX_COHORT_ESSAYS,
  INDEX_COHORT_MISREADINGS,
  INDEX_COHORT_FILM_CREDITS,
} from "@/lib/seo";
import { allAtlasCities, loadAtlasEligibility } from "@/lib/atlas";
import { cachedLineageEligibility } from "@/lib/lineage";
import { KINDS, nodeHref, sectionHref, type SectionKey } from "@/lib/catalog";
import { BROWSABLE } from "@/lib/frameworks";
import { personSlug } from "@/app/credits/credits-logic";
import crewIndex from "@/lib/crew_index.json";
import accessEnrichment from "@/lib/access_enrichment.json";
import { whereToUrl, genreUrl, theoristUrl } from "@/lib/urls";
import { CODEX_DIMS, takescoreDimUrl } from "@/lib/cinecodex_dims";
import { DESKS, DESK_KEYS, deskByMode } from "@/lib/desks";

/**
 * Sitemap data + XML rendering — SPEC §8.5
 * One exported function per child sitemap (served from app/sitemaps/*.xml) so
 * Google Search Console reports indexed counts per section. Only published
 * content. lastmod is emitted ONLY where we have an accurate content-event
 * date; a lastmod that changes every build teaches Google to distrust the
 * field sitewide, which is worse than omitting it.
 */

export type SitemapEntry = { url: string; lastmod?: string };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Supabase's API caps every response at 1,000 rows (even with .range()), so
// any table that can exceed that must be fetched in pages or the sitemap
// silently drops URLs.
const PAGE = 1000;
async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  cap = Number.POSITIVE_INFINITY
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const to = Math.min(from + PAGE, cap) - 1;
    const { data } = await run(from, to);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < to - from + 1) break;
  }
  return out;
}

// Timestamps arrive as ISO strings; date precision is all Google uses.
const isoDate = (ts: string) => ts.slice(0, 10);

/** Static hubs + blog editions. No lastmod on hubs (no accurate source). */
export async function coreEntries(): Promise<SitemapEntry[]> {
  // While not launch-ready, advertise nothing — pages are noindex anyway.
  if (!SITE_INDEXABLE) return [{ url: siteUrl }];
  const entries: SitemapEntry[] = [
    { url: siteUrl },
    { url: `${siteUrl}/about` },
    { url: `${siteUrl}/film` },
    { url: `${siteUrl}/strong-misreadings` },
    { url: `${siteUrl}/tropes` },
    { url: `${siteUrl}/latest` },
    { url: `${siteUrl}/credits` },
    { url: `${siteUrl}/takescore` },
    { url: `${siteUrl}/catalog` },
    { url: `${siteUrl}/theorist` },
    { url: `${siteUrl}/blog` },
    { url: `${siteUrl}/curious` },
    { url: `${siteUrl}/curious/misreadings` },
    { url: `${siteUrl}/curious/locations` },
    { url: `${siteUrl}/concept` },
    { url: `${siteUrl}/director` },
    { url: `${siteUrl}/genre` },
    { url: `${siteUrl}/tradition` },
    { url: `${siteUrl}/lineage` },
    { url: `${siteUrl}/frames` },
    { url: `${siteUrl}/trending` },
    { url: `${siteUrl}/where-to-watch` },
    { url: `${siteUrl}/map` },
    { url: `${siteUrl}/atlas` },
  ];
  // Strong Misreadings — the 14 framework hubs.
  for (const f of BROWSABLE) {
    entries.push({ url: `${siteUrl}/strong-misreadings/${f.slug}` });
  }
  // CineCodex — the 13 dimension landing pages (/takescore/[dim]). Static
  // editorial hubs; no lastmod (no content-event source).
  for (const d of CODEX_DIMS) {
    entries.push({ url: `${siteUrl}${takescoreDimUrl(d.slug)}` });
  }
  // Curious desk sub-indexes (/curious/[desk]) — only desks that actually
  // have verified essays (empty desks 404, and a 404 in the sitemap erodes
  // trust). One cheap head-count per desk.
  for (const k of DESK_KEYS) {
    const { count } = await db()
      .from("essays")
      .select("id", { count: "exact", head: true })
      .eq("mode", DESKS[k].mode)
      .eq("lang", "en")
      .eq("status", "verified");
    if ((count ?? 0) > 0) entries.push({ url: `${siteUrl}/curious/${k}` });
  }
  // Blog editions — edition_date is the publish date (slugs ARE dates).
  const { data: posts } = await db()
    .from("posts")
    .select("slug, edition_date")
    .eq("status", "published")
    .order("edition_date", { ascending: true });
  for (const p of posts ?? []) {
    entries.push({ url: `${siteUrl}/blog/${p.slug}`, lastmod: p.edition_date });
  }
  return entries;
}

/**
 * /film/[slug]/[desk] essay pages — Engine Room cohort 1 (SPEC: 배치전략 v2 §10).
 * Oldest-first + cap so raising INDEX_COHORT_ESSAYS only appends URLs; waves
 * were commissioned strongest-films-first, so oldest ≈ highest-value pages.
 */
export async function essaysEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  type Row = { mode: string; published_at: string | null; created_at: string; film: { slug: string } };
  const rows = await fetchAll<Row>(
    (from, to) =>
      supabase
        .from("essays")
        .select("mode, published_at, created_at, film:films!inner(slug, visible)")
        .eq("lang", "en")
        .eq("status", "verified")
        .eq("film.visible", true)
        .order("created_at", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null }>,
    INDEX_COHORT_ESSAYS
  );
  const out: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const desk = deskByMode(r.mode);
    if (!desk || !r.film?.slug) continue;
    const url = `${siteUrl}/film/${r.film.slug}/${desk.key}`;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, lastmod: isoDate(r.published_at ?? r.created_at) });
  }
  return out;
}

/**
 * Films whose /film/[slug]/misreadings article actually renders — i.e. at
 * least one published, non-invitation take (a handful of is_analyzed films
 * have none and the article 404s; never advertise or link those). ~25k take
 * rows paged once a day, reduced to a slug set. Shared by the sitemap and
 * the /curious/misreadings index.
 */
export const misreadingsEligibleSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = db();
    const rows = await fetchAll<{ figure: { film: { slug: string } } }>((from, to) =>
      supabase.from("takes")
        .select("figure:figures!inner(film:films!inner(slug, visible))")
        .eq("status", "published").eq("is_invitation", false)
        .eq("figure.film.visible", true)
        .range(from, to) as unknown as PromiseLike<{ data: { figure: { film: { slug: string } } }[] | null }>
    );
    return [...new Set(rows.map((r) => r.figure?.film?.slug).filter(Boolean))] as string[];
  },
  ["misreadings-eligible-1"],
  { revalidate: 86400 }
);

/**
 * /film/[slug]/misreadings articles (added 2026-07-07) — every analyzed film's
 * Strong Misreadings assembled as one article (9–15 readings each, LLM-free).
 * Oldest-first + cap so raising the cohort only appends URLs. The index hub is
 * /curious/misreadings (in coreEntries via the curious section).
 */
export async function misreadingsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const eligibleSet = new Set(await misreadingsEligibleSlugs());
  const films = await fetchAll<{ slug: string; created_at: string; last_processed_at: string | null }>(
    (from, to) =>
      supabase.from("films").select("slug, created_at, last_processed_at")
        .eq("visible", true).eq("is_analyzed", true)
        .order("created_at", { ascending: true }).range(from, to)
  );
  return films
    .filter((f) => eligibleSet.has(f.slug))
    .slice(0, INDEX_COHORT_MISREADINGS)
    .map((f) => ({
      url: `${siteUrl}/film/${f.slug}/misreadings`,
      lastmod: isoDate(f.last_processed_at && f.last_processed_at > f.created_at ? f.last_processed_at : f.created_at),
    }));
}

/**
 * /film/[slug]/credits pages (added 2026-07-08) — "who made this film",
 * verbalized from TMDB relations. Visible films with a TMDB id, oldest-first
 * + cap so raising the cohort only appends URLs.
 */
export async function filmCreditsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ slug: string; created_at: string; last_processed_at: string | null }>(
    (from, to) =>
      supabase.from("films").select("slug, created_at, last_processed_at")
        .eq("visible", true).not("tmdb_id", "is", null)
        .order("created_at", { ascending: true }).range(from, to),
    INDEX_COHORT_FILM_CREDITS
  );
  return films.map((f) => ({
    url: `${siteUrl}/film/${f.slug}/credits`,
    lastmod: isoDate(f.last_processed_at && f.last_processed_at > f.created_at ? f.last_processed_at : f.created_at),
  }));
}

/** Films — every visible film. */
export async function filmEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ slug: string; created_at: string; last_processed_at: string | null }>((from, to) =>
    supabase.from("films").select("slug, created_at, last_processed_at").eq("visible", true).order("slug").range(from, to)
  );
  // This catalog grows by ENRICHING existing films (figures, Q&A) — lastmod
  // must reflect the latest content event, not the row's birth, or enriched
  // pages never earn a recrawl. last_processed_at is bumped by the content
  // pipelines (Q&A loaders etc.).
  return films.map((f) => ({
    url: `${siteUrl}/film/${f.slug}`,
    lastmod: isoDate(f.last_processed_at && f.last_processed_at > f.created_at ? f.last_processed_at : f.created_at),
  }));
}

/** /movies-like/* companions — one per visible film. */
export async function moviesLikeEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ slug: string }>((from, to) =>
    supabase.from("films").select("slug").eq("visible", true).order("slug").range(from, to)
  );
  return films.map((f) => ({ url: `${siteUrl}/movies-like/${f.slug}` }));
}

/**
 * /whereto/* availability pages — only films that actually HAVE watch data,
 * so the sitemap never advertises an empty page. A film qualifies if it has a
 * film_watch_providers row (TMDB/JustWatch) OR a MetaTake access-enrichment
 * record (lib/access_enrichment.json, keyed by tmdb_id). No lastmod: provider
 * data refreshes wholesale, which would just churn the field.
 */
export async function whereToEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ id: string; slug: string; tmdb_id: number | null }>((from, to) =>
    supabase.from("films").select("id, slug, tmdb_id").eq("visible", true).order("slug").range(from, to)
  );
  const providerRows = await fetchAll<{ film_id: string }>((from, to) =>
    supabase.from("film_watch_providers").select("film_id").order("film_id").range(from, to)
  );
  const hasProviders = new Set(providerRows.map((r) => r.film_id));
  const enriched = (accessEnrichment as unknown as { films: Record<string, unknown> }).films;
  return films
    .filter((f) => hasProviders.has(f.id) || (f.tmdb_id != null && String(f.tmdb_id) in enriched))
    .map((f) => ({ url: `${siteUrl}${whereToUrl(f.slug)}` }));
}

// Genre slugs are derived from films.genres labels exactly the way
// app/genre/page.tsx links them (there is no genres table).
function slugifyGenre(g: string) {
  return g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** /genre/* — one entry per genre slug with ≥5 visible films (the hub page
 * itself lives in the core section). */
export async function genreEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ genres: string[] | null }>((from, to) =>
    supabase.from("films").select("genres").eq("visible", true).not("genres", "is", null).order("slug").range(from, to)
  );
  const counts = new Map<string, number>();
  for (const f of films) {
    for (const g of f.genres ?? []) {
      const slug = slugifyGenre(g);
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 5)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug]) => ({ url: `${siteUrl}${genreUrl(slug)}` }));
}

/**
 * Figure pages — the entity-query surface ("the feather in Forrest Gump —
 * meaning & readings"). Advertise only figures that clear the same bar the
 * page's own robots gate uses: ≥3 published takes, on a visible film.
 * PostgREST aggregates are disabled for this project, so tally the published
 * takes' figure_ids here; revalidation-time only (~45 paged requests total).
 */
export async function figureEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const films = await fetchAll<{ id: string; slug: string }>((from, to) =>
    supabase.from("films").select("id, slug").eq("visible", true).order("slug").range(from, to)
  );
  const filmSlugById = new Map(films.map((f) => [f.id, f.slug]));
  const takeFigRows = await fetchAll<{ figure_id: string }>((from, to) =>
    supabase.from("takes").select("figure_id").eq("status", "published").order("id").range(from, to)
  );
  const takesPerFigure = new Map<string, number>();
  for (const t of takeFigRows) takesPerFigure.set(t.figure_id, (takesPerFigure.get(t.figure_id) ?? 0) + 1);
  const allFigures = await fetchAll<{ id: string; slug: string | null; film_id: string; updated_at: string | null; created_at: string }>(
    (from, to) =>
      supabase.from("figures").select("id, slug, film_id, updated_at, created_at").eq("status", "approved")
        .order("created_at", { ascending: true }).order("slug", { ascending: true }).range(from, to)
  );
  return allFigures
    .filter((g) => g.slug && (takesPerFigure.get(g.id) ?? 0) >= 3 && filmSlugById.has(g.film_id))
    .slice(0, INDEX_COHORT_FIGURES)
    .map((g) => ({
      url: `${siteUrl}/film/${filmSlugById.get(g.film_id)}/figure/${g.slug}`,
      lastmod: isoDate(g.updated_at || g.created_at),
    }));
}

/** Published questions (/film/[slug]/q/[slug]). */
export async function qaEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data: questions } = await db()
    .from("questions")
    .select("slug, published_at, created_at, film:films!inner(slug, visible)")
    .eq("status", "published")
    .eq("film.visible", true);
  return (questions ?? []).map((q) => {
    const film = q.film as unknown as { slug: string };
    return {
      url: `${siteUrl}/film/${film.slug}/q/${q.slug}`,
      lastmod: isoDate(q.published_at || q.created_at),
    };
  });
}

// Published readings (/take) + tropes (/trope) — the core interpretive corpus.
// Released to search engines in deterministic cohorts (see lib/seo.ts,
// INDEX_COHORT_*): oldest-first so raising the cap only appends URLs.
export async function tropeEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const tropes = await fetchAll<{ slug: string; updated_at: string | null; created_at: string }>(
    (from, to) =>
      supabase
        .from("meta_takes")
        .select("slug, updated_at, created_at")
        .eq("status", "published")
        .eq("kind", "figure_type")
        .order("created_at", { ascending: true })
        .order("slug", { ascending: true })
        .range(from, to),
    INDEX_COHORT_TROPES
  );
  return tropes.map((m) => ({ url: `${siteUrl}/trope/${m.slug}`, lastmod: isoDate(m.updated_at || m.created_at) }));
}

export async function takeEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const readings = await fetchAll<{ slug: string; updated_at: string | null; created_at: string }>(
    (from, to) =>
      supabase
        .from("meta_takes")
        .select("slug, updated_at, created_at")
        .eq("status", "published")
        .eq("kind", "reading")
        .order("created_at", { ascending: true })
        .order("slug", { ascending: true })
        .range(from, to),
    INDEX_COHORT_READINGS
  );
  return readings.map((m) => ({ url: `${siteUrl}/take/${m.slug}`, lastmod: isoDate(m.updated_at || m.created_at) }));
}

/**
 * Crew person pages — key-craft people (writer/dp/editor/composer/pd) with
 * ≥3 films in the visible catalog (lib/crew_index.json; the page itself
 * noindexes below the same bar). Ordered by TMDB id: stable, append-only.
 */
export async function creditsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  return (crewIndex.people as { id: number; name: string }[])
    .slice(0, INDEX_COHORT_CREW)
    .map((p) => ({ url: `${siteUrl}/credits/${personSlug(p.name, p.id)}` }));
}

/** Director hubs (unique director_slugs) + life pages (gate ≥4 facts). */
export async function directorEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const entries: SitemapEntry[] = [];
  const directors = await fetchAll<{ director_slug: string | null }>((from, to) =>
    supabase
      .from("films")
      .select("director_slug")
      .eq("visible", true)
      .not("director_slug", "is", null)
      .order("slug")
      .range(from, to)
  );
  const uniqueDirectors = new Set(directors.map((d) => d.director_slug).filter(Boolean));
  for (const ds of uniqueDirectors) {
    entries.push({ url: `${siteUrl}/director/${ds}` });
  }
  // Director life pages — "Who is X?" (director_facts; ~208 rows, gate ≥4 facts
  // mirrors the page's own robots bar). Gate on uniqueDirectors too: merged
  // slugs can leave orphaned facts rows behind (slug repair keeps them for
  // losslessness), and a sitemap must never list an old_path.
  const { data: lifeRows } = await supabase.from("director_facts").select("director_slug, facts");
  for (const r of lifeRows ?? []) {
    if (Array.isArray(r.facts) && r.facts.length >= 4 && uniqueDirectors.has(r.director_slug)) {
      entries.push({ url: `${siteUrl}/director/${r.director_slug}/life` });
    }
  }
  return entries;
}

/** Concept (canonical-term) pages. */
export async function conceptEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  // Unified /concept (2026-07-07): readings-corpus vocabulary + the SM concept
  // registry (formerly noindex /idea). SM slugs gated at ≥3 readings — the
  // same non-thin bar the page's own robots gate applies.
  const [{ data: concepts }, { data: sm }] = await Promise.all([
    supabase.rpc("concept_index"),
    supabase.rpc("sm_concept_index", { p_limit: 500 }),
  ]);
  const out: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const c of (concepts ?? []) as { slug: string }[]) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push({ url: `${siteUrl}/concept/${c.slug}` });
  }
  for (const r of (sm ?? []) as { slug: string; n: number }[]) {
    if (r.n < 3 || seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({ url: `${siteUrl}/concept/${r.slug}` });
  }
  return out;
}

/**
 * Theorist lens pages (/theorist/[slug]) — the thinkers films are read
 * through. Source = the same theorist_index RPC the /theorist hub renders.
 * Advertise only theorists with ≥3 readings and a slug (the same non-thin
 * bar the figure/crew sections use; the page itself has no robots gate yet).
 * CAUTION: PostgREST caps RPC responses at 1,000 rows (~898 today) — if the
 * roster approaches 1,000, this must switch to a paged/jsonb_agg fetch or
 * URLs will be silently dropped.
 */
export async function theoristEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data } = await db().rpc("theorist_index");
  return ((data ?? []) as { slug: string | null; n: number | null }[])
    .filter((t) => t.slug && (t.n ?? 0) >= 3)
    .sort((a, b) => a.slug!.localeCompare(b.slug!))
    .map((t) => ({ url: `${siteUrl}${theoristUrl(t.slug!)}` }));
}

/**
 * Archetype catalog — Phase A (2026-07-04): named-archetype kinds only
 * (object / place / character / theme; tier taxonomies wait for Phase B),
 * nodes with ≥3 member figures (the site-wide non-thin bar), plus the four
 * section pages. Stable order (kind then slug) under the cohort cap.
 */
export async function catalogEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const sections: SectionKey[] = ["objects", "characters", "locations", "themes"];
  const entries: SitemapEntry[] = sections.map((s) => ({ url: `${siteUrl}${sectionHref(s)}` }));
  const namedKinds = KINDS.filter((k) => !k.tier && k.kind !== "theory");
  const nodes: { kind: string; slug: string }[] = [];
  for (const k of namedKinds) {
    const { data } = await supabase.rpc("catalog_browse", { p_kind: k.kind });
    for (const n of (data ?? []) as { slug: string | null; n: number | null }[]) {
      if (n.slug && (n.n ?? 0) >= 3) nodes.push({ kind: k.kind, slug: n.slug });
    }
  }
  nodes.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  for (const n of nodes.slice(0, INDEX_COHORT_CATALOG)) {
    entries.push({ url: `${siteUrl}${nodeHref(n.kind, n.slug)}` });
  }
  return entries;
}

/**
 * /film/x/locations read pages (docs/PLAN-atlas-seo.md Phase 1) — films with
 * ≥3 merged pins (same bar as the page's own 404 gate; lib/atlas.ts). The
 * eligibility RPC returns slug-ascending order, so the cohort cap only ever
 * appends. No lastmod: location data refreshes wholesale.
 */
export async function filmLocationsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { films } = await loadAtlasEligibility();
  return films
    .slice(0, INDEX_COHORT_FILM_LOCATIONS)
    .map((f) => ({ url: `${siteUrl}/film/atlas/${f.slug}` }));
}

/**
 * Atlas hubs: /atlas/[country] (≥3 films & ≥3 pins, ~73 — small set, no
 * cohort) + /director/x/locations (≥2 located films & ≥6 merged pins, ~331).
 * Both gates mirror the pages' own 404 bars.
 */
export async function atlasEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { countries, directors } = await loadAtlasEligibility();
  return [
    ...[...countries].sort((a, b) => a.slug.localeCompare(b.slug)).map((c) => ({ url: `${siteUrl}/atlas/${c.slug}` })),
    ...directors.map((d) => ({ url: `${siteUrl}/director/${d.slug}/locations` })),
  ];
}

/**
 * City & region hubs /atlas/{country}/{city} — the roster is the frozen
 * lib/atlas_cities.json artifact (worker/atlas-cities-build.py; ≥3 films +
 * geographic coherence). Stable order (country, city); the page itself
 * re-checks the ≥3-film bar via robots as drift protection.
 */
export async function cityEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  return [...allAtlasCities()]
    .sort((a, b) => a.countrySlug.localeCompare(b.countrySlug) || a.slug.localeCompare(b.slug))
    .map((c) => ({ url: `${siteUrl}/atlas/${c.countrySlug}/${c.slug}` }));
}

/**
 * /lineage/[slug] list pages — awards, canons, national honours, auteur lines
 * with ≥3 member films (the page's own robots bar; lib/lineage.ts). Small,
 * stable set (~202) — no cohort. lastmod omitted (memberships land in waves).
 */
export async function lineageEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { lists } = await cachedLineageEligibility();
  return lists.map((l) => ({ url: `${siteUrl}/lineage/${l.slug}` }));
}

/**
 * /film/lineage/[slug] — a film's complete sourced lineage record (moved
 * 2026-07-06 from /film/x/honors; old route 308s). Eligible: ≥3 film_lineage
 * rows, ANY visibility (honours are facts about the film, so Tier-2 catalog
 * films qualify too). Slug-asc order under the cohort cap so raising it only
 * appends.
 */
export async function honorsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { films } = await cachedLineageEligibility();
  return films.slice(0, INDEX_COHORT_FILM_HONORS).map((f) => ({ url: `${siteUrl}/film/lineage/${f.slug}` }));
}

/**
 * /takescore/film/[slug] — per-film TakeScore appraisal pages, one per scored
 * film (~6,701). Roster = the same cinecodex_ranked RPC the /takescore hub
 * renders (single-jsonb {total, rows} payload), paged with p_limit 500 so no
 * page approaches PostgREST's 1,000-row response cap. No lastmod: ranked rows
 * carry no scored_at, and a fabricated date is worse than none (see header).
 */
export async function sitemapTakescoreFilms(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const entries: SitemapEntry[] = [];
  const LIMIT = 500;
  for (let offset = 0; ; offset += LIMIT) {
    const { data } = await supabase.rpc("cinecodex_ranked", {
      p_sort: "u", p_lambda: 1.0, p_limit: LIMIT, p_offset: offset,
    });
    const page = data as { total: number; rows: { slug: string }[] } | null;
    const rows = page?.rows ?? [];
    for (const r of rows) {
      if (r.slug) entries.push({ url: `${siteUrl}/takescore/film/${r.slug}` });
    }
    // Stop on a short page (rows exhausted) or once the RPC's own total is
    // covered — the total guard keeps a misbehaving RPC from looping forever.
    if (rows.length < LIMIT || (page?.total != null && offset + rows.length >= page.total)) break;
  }
  return entries;
}

/** Public profiles. */
export async function profileEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data: profiles } = await db()
    .from("profiles")
    .select("username")
    .eq("is_public", true)
    .neq("role", "system");
  return (profiles ?? []).filter((p) => p.username).map((p) => ({ url: `${siteUrl}/u/${p.username}` }));
}

// ---------------------------------------------------------------------------
// XML rendering

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function urlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) =>
      e.lastmod
        ? `  <url><loc>${escapeXml(e.url)}</loc><lastmod>${e.lastmod}</lastmod></url>`
        : `  <url><loc>${escapeXml(e.url)}</loc></url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapindex(urls: string[]): string {
  const body = urls.map((u) => `  <sitemap><loc>${escapeXml(u)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
