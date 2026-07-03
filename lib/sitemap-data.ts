import { createClient } from "@supabase/supabase-js";
import {
  SITE_INDEXABLE,
  INDEX_COHORT_READINGS,
  INDEX_COHORT_TROPES,
  INDEX_COHORT_FIGURES,
  INDEX_COHORT_CREW,
} from "@/lib/seo";
import { BROWSABLE } from "@/lib/frameworks";
import { personSlug } from "@/app/credits/credits-logic";
import crewIndex from "@/lib/crew_index.json";

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
    { url: `${siteUrl}/blog` },
    { url: `${siteUrl}/blog/curious` },
    { url: `${siteUrl}/concept` },
    { url: `${siteUrl}/director` },
  ];
  // Strong Misreadings — the 14 framework hubs.
  for (const f of BROWSABLE) {
    entries.push({ url: `${siteUrl}/strong-misreadings/${f.slug}` });
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
  // mirrors the page's own robots bar).
  const { data: lifeRows } = await supabase.from("director_facts").select("director_slug, facts");
  for (const r of lifeRows ?? []) {
    if (Array.isArray(r.facts) && r.facts.length >= 4) {
      entries.push({ url: `${siteUrl}/director/${r.director_slug}/life` });
    }
  }
  return entries;
}

/** Concept (canonical-term) pages. */
export async function conceptEntries(): Promise<SitemapEntry[]> {
  if (!SITE_INDEXABLE) return [];
  const { data: concepts } = await db().rpc("concept_index");
  return ((concepts ?? []) as { slug: string }[]).map((c) => ({ url: `${siteUrl}/concept/${c.slug}` }));
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
