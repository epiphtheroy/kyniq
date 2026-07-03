import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_INDEXABLE, INDEX_COHORT_READINGS, INDEX_COHORT_TROPES, INDEX_COHORT_FIGURES, INDEX_COHORT_CREW } from "@/lib/seo";
import { BROWSABLE } from "@/lib/frameworks";
import { personSlug } from "@/app/credits/credits-logic";
import crewIndex from "@/lib/crew_index.json";

/**
 * Dynamic sitemap — SPEC §8.5
 * Only published content. Includes films, questions, director hubs, and public profiles.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  // While not launch-ready, advertise nothing — pages are noindex anyway.
  if (!SITE_INDEXABLE) return [{ url: siteUrl, lastModified: new Date() }];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/film`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/strong-misreadings`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/tropes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/latest`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/credits`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/blog/curious`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
  ];

  // Strong Misreadings — the 14 framework hubs.
  for (const f of BROWSABLE) {
    entries.push({ url: `${siteUrl}/strong-misreadings/${f.slug}`, changeFrequency: "weekly", priority: 0.75 });
  }

  // Published readings (/take) + tropes (/trope) — the core interpretive corpus.
  // Released to search engines in deterministic cohorts (see lib/seo.ts,
  // INDEX_COHORT_*): oldest-first so raising the cap only appends URLs.
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
  for (const m of readings) {
    entries.push({
      url: `${siteUrl}/take/${m.slug}`,
      lastModified: new Date(m.updated_at || m.created_at),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }
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
  for (const m of tropes) {
    entries.push({
      url: `${siteUrl}/trope/${m.slug}`,
      lastModified: new Date(m.updated_at || m.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Films — only those with real content (>=3 figures). Just-added films with no
  // figures yet are NOT advertised to search engines (thin-content guard); they
  // enter the sitemap automatically once film-extract populates them.
  const films = await fetchAll<{ id: string; slug: string; created_at: string }>((from, to) =>
    supabase.from("films").select("id, slug, created_at").eq("visible", true).order("slug").range(from, to)
  );
  for (const f of films) {
    entries.push({
      url: `${siteUrl}/film/${f.slug}`,
      lastModified: new Date(f.created_at),
      changeFrequency: "weekly",
      priority: 0.8,
    });
    entries.push({
      url: `${siteUrl}/movies-like/${f.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Figure pages — the entity-query surface ("the feather in Forrest Gump —
  // meaning & readings"). Advertise only figures that clear the same bar the
  // page's own robots gate uses: ≥3 published takes, on a visible film.
  // PostgREST aggregates are disabled for this project, so tally the published
  // takes' figure_ids here; build-time only (~45 paged requests total).
  const filmSlugById = new Map(films.map((f) => [f.id, f.slug]));
  const takeFigRows = await fetchAll<{ figure_id: string }>((from, to) =>
    supabase.from("takes").select("figure_id").eq("status", "published").order("id").range(from, to)
  );
  const takesPerFigure = new Map<string, number>();
  for (const t of takeFigRows) takesPerFigure.set(t.figure_id, (takesPerFigure.get(t.figure_id) ?? 0) + 1);
  const allFigures = await fetchAll<{ id: string; slug: string | null; film_id: string }>((from, to) =>
    supabase.from("figures").select("id, slug, film_id").eq("status", "approved")
      .order("created_at", { ascending: true }).order("slug", { ascending: true }).range(from, to)
  );
  const eligibleFigures = allFigures
    .filter((g) => g.slug && (takesPerFigure.get(g.id) ?? 0) >= 3 && filmSlugById.has(g.film_id))
    .slice(0, INDEX_COHORT_FIGURES);
  for (const g of eligibleFigures) {
    entries.push({
      url: `${siteUrl}/film/${filmSlugById.get(g.film_id)}/figure/${g.slug}`,
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }

  // Crew person pages — key-craft people (writer/dp/editor/composer/pd) with
  // ≥3 films in the visible catalog (lib/crew_index.json; the page itself
  // noindexes below the same bar). Ordered by TMDB id: stable, append-only.
  for (const person of (crewIndex.people as { id: number; name: string }[]).slice(0, INDEX_COHORT_CREW)) {
    entries.push({
      url: `${siteUrl}/credits/${personSlug(person.name, person.id)}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Concept (canonical-term) pages
  entries.push({ url: `${siteUrl}/concept`, changeFrequency: "weekly", priority: 0.7 });
  const { data: concepts } = await supabase.rpc("concept_index");
  for (const c of (concepts ?? []) as { slug: string }[]) {
    entries.push({ url: `${siteUrl}/concept/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  // Published questions
  const { data: questions } = await supabase
    .from("questions")
    .select("slug, published_at, created_at, film:films!inner(slug, visible)")
    .eq("status", "published")
    .eq("film.visible", true);

  for (const q of questions ?? []) {
    const film = q.film as unknown as { slug: string };
    entries.push({
      url: `${siteUrl}/film/${film.slug}/q/${q.slug}`,
      lastModified: new Date(q.published_at || q.created_at),
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  // Director hubs (unique director_slugs)
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
    entries.push({
      url: `${siteUrl}/director/${ds}`,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Public profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username")
    .eq("is_public", true)
    .neq("role", "system");

  for (const p of profiles ?? []) {
    if (p.username) {
      entries.push({
        url: `${siteUrl}/u/${p.username}`,
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  }

  return entries;
}
