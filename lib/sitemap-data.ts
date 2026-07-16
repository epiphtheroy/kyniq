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
  INDEX_COHORT_ESSAYS_KO,
  INDEX_COHORT_FILMS_T2,
  INDEX_COHORT_FILMS_KO,
  filmIndexBar,
  type FilmIndexSignals,
} from "@/lib/seo";
import { filmIndexRoster } from "@/lib/filmGate";
import { directorIndexBar } from "@/lib/directorGate";
import { allLocationCities, loadLocationsEligibility } from "@/lib/locations";
import { cachedLineageEligibility } from "@/lib/lineage";

// SEO consolidation gate (HANDOFF §2.6): the set of slugs whose MAIN page is
// indexable (Tier-1 visible + gate-passing Tier-2), so film-subpage sitemaps
// advertise exactly that set and never a noindex URL. Callers treat an empty set
// (RPC error) as "gate unavailable" and fall back to their prior behaviour rather
// than dropping coverage — degrade, don't crash (lib/sitemap-data fetchAll rule).
async function gatePassingSlugs(): Promise<Set<string>> {
  try {
    const roster = await filmIndexRoster();
    const out = new Set<string>();
    for (const slug in roster) if (filmIndexBar(roster[slug])) out.add(slug);
    return out;
  } catch {
    return new Set<string>();
  }
}
import { KINDS, nodeHref, sectionHref, type SectionKey } from "@/lib/catalog";
import { BROWSABLE } from "@/lib/frameworks";
import { personSlug } from "@/app/credits/credits-logic";
import crewIndex from "@/lib/crew_index.json";
import accessEnrichment from "@/lib/access_enrichment.json";
import { whereToUrl, genreUrl, theoristUrl } from "@/lib/urls";
import { CODEX_DIMS, takescoreDimUrl } from "@/lib/cinecodex_dims";
import { DESKS, DESK_KEYS, deskByMode } from "@/lib/desks";
import { DOCS as METHOD_DOCS, docHref } from "@/lib/docs/registry";
import { DOC_BODIES } from "@/lib/docs/content";
import { POE_ESSAYS, poeHref } from "@/lib/poetics/registry";
import { POE_BODIES } from "@/lib/poetics/content";
import { LATEST_UPDATE_DATE } from "@/lib/updates/posts";

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
    // A build-time DB/network hiccup (these routes are force-static and Supabase
    // rejects, not just returns null, on a connection failure) must NOT crash the
    // whole `next build` export. Degrade to the entries gathered so far; the next
    // hourly revalidation regenerates the full sitemap once the DB is healthy.
    let data: T[] | null = null;
    try { ({ data } = await run(from, to)); } catch { break; }
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
    { url: `${siteUrl}/updates`, lastmod: LATEST_UPDATE_DATE },
    { url: `${siteUrl}/film` },
    { url: `${siteUrl}/strong-misreadings` },
    { url: `${siteUrl}/tropes` },
    { url: `${siteUrl}/latest` },
    { url: `${siteUrl}/credits` },
    { url: `${siteUrl}/takescore` },
    { url: `${siteUrl}/what-to-watch` },
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
    { url: `${siteUrl}/network` },
    { url: `${siteUrl}/locations` },
    { url: `${siteUrl}/data` }, // dataset distribution hub (Dataset JSON-LD)
    { url: `${siteUrl}/partners` }, // machine-readable B2B proposal (§2.1)
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

/** The Method Docs — the /methodology hub + every authored sub-doc. Static
 * editorial hubs; no lastmod (no content-event source). A stub (empty body)
 * is 404 on-page, so only authored docs are advertised. */
export async function methodologyEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const entries: SitemapEntry[] = [{ url: `${siteUrl}/methodology` }];
  for (const d of METHOD_DOCS) {
    if (d.slug === "overview") continue;
    if (!DOC_BODIES[d.slug]) continue; // unauthored stub → not advertised
    entries.push({ url: `${siteUrl}${docHref(d.slug)}` });
  }
  return entries;
}

/** Poetics — the /poetics hub + every authored essay. Static editorial; no
 * lastmod. A stub (empty body) is 404 on-page, so only authored essays ship. */
export async function poeticsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const entries: SitemapEntry[] = [{ url: `${siteUrl}/poetics` }];
  for (const e of POE_ESSAYS) {
    if (!POE_BODIES[e.slug]) continue;
    entries.push({ url: `${siteUrl}${poeHref(e.slug)}` });
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
 * /film/[slug]/[desk]/ko — verified Korean essays (added 2026-07-08). The EN
 * essaysEntries mirror; separate child so GSC reports KR indexation on its own.
 * Oldest-first + cap, same append-only discipline.
 */
export async function essaysKoEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  type Row = { mode: string; published_at: string | null; created_at: string; film: { slug: string } };
  const rows = await fetchAll<Row>(
    (from, to) =>
      supabase
        .from("essays")
        .select("mode, published_at, created_at, film:films!inner(slug, visible)")
        .eq("lang", "ko")
        .eq("status", "verified")
        .eq("film.visible", true)
        .order("created_at", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null }>,
    INDEX_COHORT_ESSAYS_KO
  );
  const out: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const desk = deskByMode(r.mode);
    if (!desk || !r.film?.slug) continue;
    const url = `${siteUrl}/film/${r.film.slug}/${desk.key}/ko`;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, lastmod: isoDate(r.published_at ?? r.created_at) });
  }
  return out;
}

/**
 * /movements/[slug] — national cinemas & film movements (added 2026-07-08).
 * The /movements index 308s to /lineage, so these had zero crawl entry. Gate
 * mirrors the page's own thin-hub rule (≥8 films → indexable; <8 is noindex).
 */
export async function movementEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data } = await db().rpc("movements_index");
  const groups = (data ?? {}) as { national?: { slug: string; film_count: number | null }[]; movement?: { slug: string; film_count: number | null }[] };
  const all = [...(groups.national ?? []), ...(groups.movement ?? [])];
  return all
    .filter((m) => m.slug && (m.film_count ?? 0) >= 8)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((m) => ({ url: `${siteUrl}/movements/${m.slug}` }));
}

/**
 * /tradition/[slug] — schools from the unified taxonomy (theory_schools_index).
 * These pages are indexable and hub-linked but had zero sitemap entry. Gate
 * mirrors the /tradition index and each page's own robots (films > 0).
 */
export async function traditionEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data } = await db().rpc("theory_schools_index");
  const rows = (data ?? []) as { slug: string; films: number | null }[];
  return rows
    .filter((r) => r.slug && (r.films ?? 0) > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((r) => ({ url: `${siteUrl}/tradition/${r.slug}` }));
}

// /tv/[slug] and /tv/list/[slug] are noindex (2026-07-16): a per-broadcast page
// is a single video and a watch-list is a playlist wrapper — neither is a
// standalone indexable document, so neither is advertised in any sitemap. The
// former tvListEntries / tvProgramVideoEntries emitters + the videoUrlset
// renderer + the tv-programs / tv-lists sitemap routes were removed together.

/**
 * /director/[slug]/start + /director/[slug]/next — the promoted director
 * guide articles (added 2026-07-09). Advertise only the indexable cohort
 * (≥3 items — mirrors each page's pageRobots gate; pages themselves render
 * from 1 item but thin ones stay noindex and out of the sitemap).
 */
async function directorGuideSlugs(table: "director_picks" | "director_next"): Promise<string[]> {
  const supabase = db();
  const rows = await fetchAll<{ director_slug: string }>(
    (from, to) => supabase.from(table).select("director_slug").order("director_slug").range(from, to),
    5000
  );
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.director_slug, (count.get(r.director_slug) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n >= 3).map(([s]) => s).sort();
}

/**
 * Per-director eligibility for the wave-2 aggregation articles (2026-07-09):
 * takescore / honors / reception / theory. One daily-cached pass that mirrors
 * each page's pageRobots gate (≥3 / ≥3 / ≥3 / ≥5), aggregated from the film
 * tables per director. Shared by the sitemaps and /curious/directors.
 */
export const directorLayerEligibility = unstable_cache(
  async (): Promise<{ takescore: string[]; honors: string[]; reception: string[]; theory: string[]; misreadings: string[] }> => {
    const supabase = db();
    const films = await fetchAll<{ id: string; director_slug: string | null }>((from, to) =>
      supabase.from("films").select("id, director_slug").eq("visible", true).not("director_slug", "is", null)
        .order("id").range(from, to));
    const dirOf = new Map(films.map((f) => [f.id, f.director_slug as string]));
    const filmsPerDir = new Map<string, number>();
    for (const f of films) filmsPerDir.set(f.director_slug!, (filmsPerDir.get(f.director_slug!) ?? 0) + 1);

    const tally = async (rows: { film_id: string }[]) => {
      const per = new Map<string, number>();
      for (const r of rows) {
        const d = dirOf.get(r.film_id);
        if (d) per.set(d, (per.get(d) ?? 0) + 1);
      }
      return per;
    };
    const [lineageRows, wdRows, rcpRows, takeRows] = await Promise.all([
      fetchAll<{ film_id: string }>((from, to) => supabase.from("film_lineage").select("film_id").order("id").range(from, to)),
      fetchAll<{ film_id: string }>((from, to) => supabase.from("film_wd_honors").select("film_id").order("id").range(from, to)),
      fetchAll<{ film_id: string }>((from, to) => supabase.from("film_reception").select("film_id").order("id").range(from, to)),
      fetchAll<{ figure: { film_id: string } }>((from, to) =>
        supabase.from("takes").select("figure:figures!inner(film_id)").eq("status", "published").eq("is_invitation", false)
          .range(from, to) as unknown as PromiseLike<{ data: { figure: { film_id: string } }[] | null }>),
    ]);
    const honorsPer = await tally([...lineageRows, ...wdRows]);
    const rcpPer = await tally(rcpRows);
    const theoryPer = await tally(takeRows.map((r) => ({ film_id: r.figure?.film_id })).filter((r) => r.film_id) as { film_id: string }[]);
    const pick = (per: Map<string, number>, min: number) =>
      [...per.entries()].filter(([, n]) => n >= min).map(([s]) => s).sort();
    return {
      takescore: [...filmsPerDir.entries()].filter(([, n]) => n >= 3).map(([s]) => s).sort(),
      honors: pick(honorsPer, 3),
      reception: pick(rcpPer, 3),
      theory: pick(theoryPer, 5),
      // Same readings corpus as theory; the /misreadings article gates ≥5 too.
      misreadings: pick(theoryPer, 5),
    };
  },
  // v2: misreadings slugs joined (2026-07-09)
  ["director-layer-eligibility-2"],
  { revalidate: 86400 }
);

export async function directorMisreadingsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const e = await directorLayerEligibility();
  return e.misreadings.map((s) => ({ url: `${siteUrl}/director/${s}/misreadings` }));
}
export async function directorTakescoreEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const e = await directorLayerEligibility();
  return e.takescore.map((s) => ({ url: `${siteUrl}/director/${s}/takescore` }));
}
export async function directorHonorsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const e = await directorLayerEligibility();
  return e.honors.map((s) => ({ url: `${siteUrl}/director/${s}/honors` }));
}
export async function directorReceptionEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const e = await directorLayerEligibility();
  return e.reception.map((s) => ({ url: `${siteUrl}/director/${s}/reception` }));
}
export async function directorTheoryEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const e = await directorLayerEligibility();
  return e.theory.map((s) => ({ url: `${siteUrl}/director/${s}/theory` }));
}

export async function directorStartEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const slugs = await directorGuideSlugs("director_picks");
  return slugs.map((s) => ({ url: `${siteUrl}/director/${s}/start` }));
}

export async function directorNextEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const slugs = await directorGuideSlugs("director_next");
  return slugs.map((s) => ({ url: `${siteUrl}/director/${s}/next` }));
}

/**
 * /concept/domain/[domain] — the 14 discipline-domain concept hubs and
 * /frame/[slug] frames (added 2026-07-08). Small fixed editorial sets; each
 * entry is verified to render (non-empty) before advertising, so the sitemap
 * never carries a soft-404.
 */
const CONCEPT_DOMAIN_SLUGS = [
  "politics", "criticism", "economics", "culture", "society", "psychology",
  "family", "art", "medicine", "management", "law", "history", "nature", "literature",
] as const;
const DOMAIN_PART: Record<string, string> = {
  politics: "Politics", criticism: "Criticism", economics: "Economics", culture: "Culture",
  society: "Society", psychology: "Psychology", family: "Family", art: "Art",
  medicine: "Medicine", management: "Management", law: "Law", history: "History",
  nature: "Nature", literature: "Literature",
};
export async function conceptDomainEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const out: SitemapEntry[] = [];
  for (const slug of CONCEPT_DOMAIN_SLUGS) {
    const { data } = await supabase.rpc("concept_domain_live", { p_part: DOMAIN_PART[slug] });
    if (Array.isArray(data) && data.length > 0) out.push({ url: `${siteUrl}/concept/domain/${slug}` });
  }
  return out;
}

export async function frameEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const { data: frames } = await supabase.from("frames").select("id, slug").eq("status", "approved");
  const list = (frames ?? []) as { id: string; slug: string }[];
  const out: SitemapEntry[] = [];
  for (const f of list) {
    // Page 404s with no primary instance on a published question — mirror that gate.
    const { count } = await supabase
      .from("question_frames")
      .select("question:questions!inner(status)", { count: "exact", head: true })
      .eq("frame_id", f.id)
      .eq("is_primary", true)
      .eq("question.status", "published");
    if ((count ?? 0) > 0) out.push({ url: `${siteUrl}/frame/${f.slug}` });
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
 * /film/meaning/[slug] articles (route moved from /film/[slug]/misreadings
 * 2026-07-16) — every analyzed film's Strong Misreadings assembled as one
 * article (9–15 readings each, LLM-free). Oldest-first + cap so raising the
 * cohort only appends URLs. The index hub is /curious/misreadings.
 *
 * Coupling invariant (sitemap ⊆ indexable): misreadingsEligibleSlugs gates on
 * ">=1 published non-invitation take" (the render/404 gate, shared with the
 * /curious index), whereas the page's robots gate is pageRobots(n >= 5). These
 * are only equal by data: verified 2026-07-16 that every visible+analyzed film
 * with >=1 reading has >=5 (leak of 1–4-reading films = 0). If the factory ever
 * ships a film with 1–4 readings, add a per-film ">=5 approved-figure readings"
 * count filter HERE (not in the shared misreadingsEligibleSlugs) so this sitemap
 * never advertises a noindex meaning page.
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
      // Route moved 2026-07-16: /film/[slug]/misreadings -> /film/meaning/[slug]
      // (old path 308-redirects). Advertise the new canonical only.
      url: `${siteUrl}/film/meaning/${f.slug}`,
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

/** Per-film afterlife timelines — mirrors the page's raised index bar
 *  (reception/page.tsx, 2026-07-16): advertise a reception page only when the
 *  film carries a substantial archive — criticism + scholarship reviews plus
 *  Wikidata honors, summed >= 8 (up from the old ">=1 reception OR >=3 honors"
 *  union). The page's 4th term, dated award/festival/section lineage, is
 *  intentionally omitted here: dropping a non-negative term keeps this set a
 *  strict SUBSET of what the page indexes, so the sitemap can never advertise a
 *  noindex page; the few lineage-only films remain reachable via internal links.
 *  Reception is filtered to {criticism, academic} so a future kind can't inflate
 *  the count past the page's reviews+papers sum. */
const RECEPTION_INDEX_MIN = 8;
export async function filmReceptionEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const rows = await fetchAll<{ film_id: string; created_at: string }>(
    (from, to) => supabase.from("film_reception").select("film_id, created_at")
      .in("kind", ["criticism", "academic"]).order("film_id").range(from, to),
    20000
  );
  const rcpCount = new Map<string, number>();
  const latestByFilm = new Map<string, string>();
  for (const r of rows) {
    rcpCount.set(r.film_id, (rcpCount.get(r.film_id) ?? 0) + 1);
    const cur = latestByFilm.get(r.film_id);
    if (!cur || r.created_at > cur) latestByFilm.set(r.film_id, r.created_at);
  }
  const honorRows = await fetchAll<{ film_id: string }>(
    (from, to) => supabase.from("film_wd_honors").select("film_id").order("film_id").range(from, to),
    40000
  );
  const honorCount = new Map<string, number>();
  for (const h of honorRows) honorCount.set(h.film_id, (honorCount.get(h.film_id) ?? 0) + 1);

  const ids = new Set<string>();
  for (const fid of new Set<string>([...rcpCount.keys(), ...honorCount.keys()])) {
    if ((rcpCount.get(fid) ?? 0) + (honorCount.get(fid) ?? 0) >= RECEPTION_INDEX_MIN) ids.add(fid);
  }
  const idList = [...ids];
  const films: { id: string; slug: string }[] = [];
  for (let i = 0; i < idList.length; i += 150) {
    const { data } = await supabase.from("films").select("id, slug").in("id", idList.slice(i, i + 150));
    films.push(...((data ?? []) as { id: string; slug: string }[]));
  }
  films.sort((a, b) => a.slug.localeCompare(b.slug));
  // Subpage invariant (HANDOFF §2.6): only advertise reception pages whose film's
  // main page is indexable. Degrade to the prior (unfiltered) set if the gate is down.
  const gate = await gatePassingSlugs();
  const useGate = gate.size > 0;
  return films
    .filter((f) => !useGate || gate.has(f.slug))
    .map((f) => {
      const ts = latestByFilm.get(f.id);
      return ts
        ? { url: `${siteUrl}/film/${f.slug}/reception`, lastmod: isoDate(ts) }
        : { url: `${siteUrl}/film/${f.slug}/reception` };
    });
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
  const base = films.map((f) => ({
    url: `${siteUrl}/film/${f.slug}`,
    lastmod: isoDate(f.last_processed_at && f.last_processed_at > f.created_at ? f.last_processed_at : f.created_at),
  }));
  // SEO consolidation (HANDOFF §2.6): also advertise gate-passing Tier-2 catalog
  // films (is_analyzed=false), released oldest-first under INDEX_COHORT_FILMS_T2 —
  // append-only, so raising the cap only appends. None added on RPC error.
  let roster: Record<string, FilmIndexSignals> = {};
  try { roster = await filmIndexRoster(); } catch { roster = {}; }
  const tier2 = Object.values(roster)
    .filter((s) => !s.is_analyzed && filmIndexBar(s))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .slice(0, INDEX_COHORT_FILMS_T2)
    .map((s) => ({
      url: `${siteUrl}/film/${s.slug}`,
      ...(s.created_at ? { lastmod: isoDate(s.created_at) } : {}),
    }));
  return [...base, ...tier2];
}

/**
 * /ko/film/* mains — the Korean projection sitemap (work order §6.2, §6.3, §6.5).
 *
 * Strict subset of the indexable set, twice over:
 *   1. §6.2 gate — a film is here only when it has a real ko title AND overview
 *      (the same bar the ko page uses for its own robots), so this shard never
 *      lists a URL the page itself noindexes.
 *   2. §6.5 selection — capped at INDEX_COHORT_FILMS_KO, ordered by Korean
 *      substance rather than row age: Tier-2 catalog films first (their
 *      deterministic digest IS the body, so a template translation makes the page
 *      almost fully Korean — the least mixed-language, lowest canonical-folding
 *      risk), then the rest with a ko overview. Append-only: raising the cap only
 *      appends, on the weekly GSC-evidence rule.
 *
 * Before migration 0105 the _ko columns don't exist; the select 400s, fetchAll's
 * caller-degrades rule yields [], and the shard is simply empty. No crash, no
 * bad URLs — the sitemap grows itself once the backfill lands.
 */
export async function filmsKoEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  type Row = { slug: string; is_analyzed: boolean; created_at: string; last_processed_at: string | null };
  let rows: Row[];
  try {
    rows = await fetchAll<Row>(
      (from, to) =>
        supabase
          .from("films")
          .select("slug, is_analyzed, created_at, last_processed_at")
          .eq("visible", true)
          .not("title_ko", "is", null)
          .not("overview_ko", "is", null)
          .order("slug")
          .range(from, to) as unknown as PromiseLike<{ data: Row[] | null }>,
    );
  } catch {
    return []; // columns absent (pre-0105) or read failed — empty shard, not a broken build
  }
  // A ko page is only advertised when its English twin also clears the gate
  // (the ko robots inherits it): intersect with the roster.
  let roster: Record<string, FilmIndexSignals> = {};
  try {
    roster = await filmIndexRoster();
  } catch {
    roster = {};
  }
  const eligible = rows.filter((r) => {
    const sig = roster[r.slug];
    // Tier-1 visible films are always gate-passing; Tier-2 must clear filmIndexBar.
    return r.is_analyzed ? true : sig ? filmIndexBar(sig) : false;
  });
  // §6.5 ordering: Tier-2 catalog records (digest-first, least mixed-language)
  // ahead of Tier-1, then oldest-first within each so the cohort is deterministic
  // and append-only.
  eligible.sort((a, b) => {
    if (a.is_analyzed !== b.is_analyzed) return a.is_analyzed ? 1 : -1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  return eligible.slice(0, INDEX_COHORT_FILMS_KO).map((f) => ({
    url: `${siteUrl}/ko/film/${f.slug}`,
    lastmod: isoDate(f.last_processed_at && f.last_processed_at > f.created_at ? f.last_processed_at : f.created_at),
  }));
}

/** /movies-like/* companions — one per visible film. */
export async function moviesLikeEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  // Mirror the page bar EXACTLY (app/movies-like/[slug]: filmMainIndexable && recs>=3),
  // fixing the old contradiction where every visible film was advertised but the page
  // noindexed <3-rec films. n_affinities counts only visible-related recs (RPC 0097).
  // Empty on RPC error — better a temporary gap than re-advertising noindex URLs.
  let roster: Record<string, FilmIndexSignals> = {};
  try { roster = await filmIndexRoster(); } catch { roster = {}; }
  const gated = Object.values(roster)
    .filter((s) => filmIndexBar(s) && (s.n_affinities ?? 0) >= 3)
    .map((s) => s.slug)
    .sort();
  if (gated.length > 0) return gated.map((slug) => ({ url: `${siteUrl}/movies-like/${slug}` }));
  // Roster unavailable (e.g. RPC not yet migrated): degrade to the prior all-visible
  // set rather than emptying the sitemap — coverage over the (soft) noindex mismatch.
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

/** Director hubs + life pages (gate ≥4 facts).
 *
 * D6 (2026-07-15, HANDOFF-Tier2-메인통합.md §4): advertise a hub ONLY if it clears
 * directorIndexBar — the SAME predicate app/director/[slug]/page.tsx applies via
 * pageRobots, so the sitemap and the page can never drift (the filmGate/filmIndexBar
 * mirror pattern above). Previously every visible-film director slug was advertised
 * with no bar, so ~506 single-film hubs with an empty editorial layer were indexed.
 * The (receptionN + honorsN) rescue is summed from the SAME per-film signal roster
 * the film gate uses (n_reception + n_lineage + n_wd_honors == the hub's receptionN +
 * honorsN). Life pages keep their own ≥4-facts bar — a hub may be noindex while its
 * life subpage indexes (each subpage passes its own bar). */
export async function directorEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const supabase = db();
  const entries: SitemapEntry[] = [];

  // Visible films with a director → total-per-director AND the film→director map
  // for the reception/honors rescue signal.
  const filmRows = await fetchAll<{ slug: string; director_slug: string | null }>((from, to) =>
    supabase
      .from("films")
      .select("slug, director_slug")
      .eq("visible", true)
      .not("director_slug", "is", null)
      .order("slug")
      .range(from, to)
  );
  const totalByDir = new Map<string, number>();
  const dirByFilmSlug = new Map<string, string>();
  for (const r of filmRows) {
    if (!r.director_slug) continue;
    totalByDir.set(r.director_slug, (totalByDir.get(r.director_slug) ?? 0) + 1);
    dirByFilmSlug.set(r.slug, r.director_slug);
  }
  const uniqueDirectors = new Set(totalByDir.keys());

  // Editorial-layer signals per director — the exact fields directorIndexBar reads.
  const [{ data: portraitRows }, { data: factRows }, { data: pickRows }, { data: nextRows }] = await Promise.all([
    supabase.from("director_portrait").select("director_slug"),
    supabase.from("director_facts").select("director_slug, facts"),
    supabase.from("director_picks").select("director_slug"),
    supabase.from("director_next").select("director_slug"),
  ]);
  const hasPortrait = new Set(((portraitRows ?? []) as { director_slug: string }[]).map((r) => r.director_slug));
  const factsLen = new Map<string, number>();
  for (const r of (factRows ?? []) as { director_slug: string; facts: unknown }[]) {
    factsLen.set(r.director_slug, Array.isArray(r.facts) ? r.facts.length : 0);
  }
  const countBy = (rows: { director_slug: string }[] | null | undefined): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.director_slug, (m.get(r.director_slug) ?? 0) + 1);
    return m;
  };
  const picksLen = countBy(pickRows as { director_slug: string }[] | null);
  const nextLen = countBy(nextRows as { director_slug: string }[] | null);

  // receptionN + honorsN per director, summed from the shared per-film roster.
  // Empty on RPC error → the rescue clause simply doesn't fire (degrade, not crash).
  const recHonorsByDir = new Map<string, number>();
  try {
    const roster = await filmIndexRoster();
    for (const slug in roster) {
      const ds = dirByFilmSlug.get(slug);
      if (!ds) continue;
      const s = roster[slug];
      const v = (s.n_reception ?? 0) + (s.n_lineage ?? 0) + (s.n_wd_honors ?? 0);
      recHonorsByDir.set(ds, (recHonorsByDir.get(ds) ?? 0) + v);
    }
  } catch { /* leave empty */ }

  for (const ds of uniqueDirectors) {
    const signals = {
      total: totalByDir.get(ds) ?? 0,
      portrait: hasPortrait.has(ds) || null,
      facts: { facts: { length: factsLen.get(ds) ?? 0 } },
      picks: { length: picksLen.get(ds) ?? 0 },
      next: { length: nextLen.get(ds) ?? 0 },
      receptionN: recHonorsByDir.get(ds) ?? 0, // combined rec+honors (honorsN 0 → sum holds)
      honorsN: 0,
    };
    if (directorIndexBar(signals)) entries.push({ url: `${siteUrl}/director/${ds}` });
  }

  // Director life pages — "Who is X?" (gate ≥4 facts mirrors the subpage's own
  // robots bar; reuses factRows). Gate on uniqueDirectors too: merged slugs can
  // leave orphaned facts rows behind, and a sitemap must never list an old_path.
  for (const r of (factRows ?? []) as { director_slug: string; facts: unknown }[]) {
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
 * ≥3 merged pins (same bar as the page's own 404 gate; lib/locations.ts). The
 * eligibility RPC returns slug-ascending order, so the cohort cap only ever
 * appends. No lastmod: location data refreshes wholesale.
 */
export async function filmLocationsEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { films } = await loadLocationsEligibility();
  return films
    .slice(0, INDEX_COHORT_FILM_LOCATIONS)
    .map((f) => ({ url: `${siteUrl}/film/locations/${f.slug}` }));
}

/**
 * Atlas hubs: /locations/[country] (≥3 films & ≥3 pins, ~73 — small set, no
 * cohort) + /director/x/locations (≥2 located films & ≥6 merged pins, ~331).
 * Both gates mirror the pages' own 404 bars.
 */
export async function locationHubEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { countries, directors } = await loadLocationsEligibility();
  return [
    ...[...countries].sort((a, b) => a.slug.localeCompare(b.slug)).map((c) => ({ url: `${siteUrl}/locations/${c.slug}` })),
    ...directors.map((d) => ({ url: `${siteUrl}/director/${d.slug}/locations` })),
  ];
}

/**
 * City & region hubs /locations/{country}/{city} — the roster is the frozen
 * lib/atlas_cities.json artifact (worker/atlas-cities-build.py; ≥3 films +
 * geographic coherence). Stable order (country, city); the page itself
 * re-checks the ≥3-film bar via robots as drift protection.
 */
export async function cityEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  return [...allLocationCities()]
    .sort((a, b) => a.countrySlug.localeCompare(b.countrySlug) || a.slug.localeCompare(b.slug))
    .map((c) => ({ url: `${siteUrl}/locations/${c.countrySlug}/${c.slug}` }));
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
  // Subpage invariant (HANDOFF §2.6): only advertise /film/lineage pages whose film's
  // main page is indexable (was: any visibility). Degrade to prior set if gate is down.
  const gate = await gatePassingSlugs();
  const useGate = gate.size > 0;
  return films
    .filter((f) => !useGate || gate.has(f.slug))
    .slice(0, INDEX_COHORT_FILM_HONORS)
    .map((f) => ({ url: `${siteUrl}/film/lineage/${f.slug}` }));
}

// /takescore/film/[slug] pages are noindex (2026-07-16): ~6,701 scored films
// share one value/cost/risk template, so the score lives on /film/[slug] as a
// section rather than as thousands of near-identical standalone pages. The
// former sitemapTakescoreFilms emitter + the takescore-films sitemap route were
// removed together. The 13 /takescore/[dim] dimension landing pages stay indexed
// (emitted from coreEntries, unaffected).

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

// /now/[slug] — Now Playing, the live layer (hourly/README.md v2). Published
// pieces only; lastmod = updated_at, which the pipeline touches only on real
// content events (publish + corrections), so it is an accurate signal.
export async function nowEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data } = await db()
    .from("now_articles")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(PAGE);
  const entries: SitemapEntry[] = [{ url: `${siteUrl}/now` }];
  for (const p of data ?? []) {
    entries.push({ url: `${siteUrl}/now/${p.slug}`, lastmod: (p.updated_at as string)?.slice(0, 10) });
  }
  const { data: digests } = await db()
    .from("now_digests")
    .select("digest_date, updated_at")
    .order("digest_date", { ascending: false })
    .limit(PAGE);
  for (const d of digests ?? []) {
    entries.push({ url: `${siteUrl}/now/daily/${d.digest_date}`, lastmod: (d.updated_at as string)?.slice(0, 10) });
  }
  return entries;
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
