/**
 * lib/hubExplore.ts — the "Keep exploring" footer for ENTITY/CATEGORY hub pages
 * (genre / lineage / frame / tradition / movement / person). Unlike the
 * single-film footer (ReadPlates), a hub is about a category, not one film — so
 * the funnel is sideways (sibling entities of the same kind) and up (the index
 * hub + adjacent layers), never a "read the full film" CTA.
 *
 * SEO rules mirror lib/related.ts: deterministic ordering, per-entity-varied
 * links (each hub gets a DIFFERENT sibling set), current entity excluded, only
 * resolvable targets. Cached per (kind, slug); the genre co-occurrence graph is
 * cached once site-wide and shared by every genre page.
 */
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export type HubKind = "genre" | "lineage" | "frame" | "tradition" | "movement" | "person";
export type HubLink = { href: string; label: string; meta?: string };
export type HubExplore = {
  intro: string;
  siblings: HubLink[];
  browse: HubLink;
  crossLinks: HubLink[];
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const slugifyGenre = (g: string) => g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/* ── genre co-occurrence graph (built once, shared by every genre page) ──────
   For each genre slug, the genres that most often share a film with it —
   genuinely "related genres", ranked by co-occurrence count. */
type GenreGraph = Record<string, { slug: string; label: string; n: number }[]>;

const cachedGenreGraph = unstable_cache(
  async (): Promise<GenreGraph> => {
    const supabase = db();
    const PAGE = 1000;
    const rows: { genres: string[] | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from("films").select("genres").eq("visible", true).order("id").range(from, from + PAGE - 1);
      if (!data?.length) break;
      rows.push(...(data as { genres: string[] | null }[]));
      if (data.length < PAGE) break;
    }
    // slug -> display label (first seen), and slug -> (coSlug -> count)
    const label = new Map<string, string>();
    const co = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const gs = [...new Set((r.genres ?? []).filter(Boolean))];
      const slugs = gs.map((g) => { const s = slugifyGenre(g); if (s && !label.has(s)) label.set(s, g); return s; }).filter(Boolean);
      for (const a of slugs) {
        const m = co.get(a) ?? new Map<string, number>();
        for (const b of slugs) if (b !== a) m.set(b, (m.get(b) ?? 0) + 1);
        co.set(a, m);
      }
    }
    const graph: GenreGraph = {};
    for (const [a, m] of co) {
      graph[a] = [...m.entries()]
        .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
        .slice(0, 12)
        .map(([s, n]) => ({ slug: s, label: label.get(s) ?? titleCase(s.replace(/-/g, " ")), n }));
    }
    return graph;
  },
  ["genre-graph-1"],
  { revalidate: 86400 },
);

async function genreSiblings(slug: string): Promise<HubLink[]> {
  const graph = await cachedGenreGraph();
  return (graph[slug.toLowerCase()] ?? []).map((g) => ({
    href: `/genre/${g.slug}`, label: g.label, meta: `${g.n} shared`,
  }));
}

async function lineageSiblings(slug: string): Promise<HubLink[]> {
  const supabase = db();
  const { data: cur } = await supabase.from("lineage_lists").select("facet").eq("slug", slug).maybeSingle();
  const facet = (cur as { facet: string | null } | null)?.facet ?? null;
  let q = supabase.from("lineage_lists")
    .select("slug, label, film_count").eq("status", "active").neq("slug", slug)
    .order("film_count", { ascending: false, nullsFirst: false }).limit(12);
  if (facet) q = q.eq("facet", facet);
  const { data } = await q;
  return ((data ?? []) as { slug: string; label: string; film_count: number | null }[])
    .filter((r) => r.slug && r.label)
    .map((r) => ({ href: `/lineage/${r.slug}`, label: r.label, ...(r.film_count ? { meta: `${r.film_count} films` } : {}) }));
}

async function frameSiblings(slug: string): Promise<HubLink[]> {
  const supabase = db();
  const { data: cur } = await supabase.from("frames").select("dimension").eq("slug", slug).maybeSingle();
  const dim = (cur as { dimension: string | null } | null)?.dimension ?? null;
  let q = supabase.from("frames")
    .select("slug, label, dimension").is("merged_into", null).neq("slug", slug)
    .order("label").limit(12);
  if (dim) q = q.eq("dimension", dim);
  const { data } = await q;
  return ((data ?? []) as { slug: string; label: string }[])
    .filter((r) => r.slug && r.label)
    .map((r) => ({ href: `/frame/${r.slug}`, label: r.label }));
}

async function traditionSiblings(slug: string): Promise<HubLink[]> {
  const supabase = db();
  const { data } = await supabase.rpc("theory_schools_index");
  const rows = (data as { slug: string; name?: string; films?: number }[] | null) ?? [];
  return rows
    .filter((r) => r.slug && r.slug !== slug)
    .slice(0, 12)
    .map((r) => ({
      href: `/tradition/${r.slug}`,
      label: r.name ?? r.slug.replace(/-/g, " "),
      ...(r.films ? { meta: `${r.films} films` } : {}),
    }));
}

const KIND_META: Record<HubKind, { intro: string; browse: HubLink; crossLinks: HubLink[] }> = {
  genre: {
    intro: "More genres to explore, and the films they share with this one.",
    browse: { href: "/genre", label: "Browse every genre" },
    crossLinks: [
      { href: "/takescore", label: "The Screener — films ranked by TakeScore" },
      { href: "/network", label: "The connections map" },
    ],
  },
  lineage: {
    intro: "More canons, awards and national lineages on Metatake.",
    browse: { href: "/lineage", label: "Browse every lineage & canon" },
    crossLinks: [
      { href: "/takescore", label: "Films ranked by TakeScore" },
      { href: "/film", label: "The full film index" },
    ],
  },
  frame: {
    intro: "More reading frames — the lenses Metatake reads films through.",
    browse: { href: "/frames", label: "Browse every frame" },
    crossLinks: [
      { href: "/concept", label: "The concepts behind the frames" },
      { href: "/tradition", label: "The critical traditions" },
    ],
  },
  tradition: {
    intro: "More critical traditions and schools of reading.",
    browse: { href: "/tradition", label: "Browse every tradition" },
    crossLinks: [
      { href: "/concept", label: "The concepts they use" },
      { href: "/theorist", label: "The theorists behind them" },
    ],
  },
  movement: {
    intro: "More film movements and national cinemas to explore.",
    browse: { href: "/movements", label: "Browse every movement & national cinema" },
    crossLinks: [
      { href: "/lineage", label: "Canons & awards" },
      { href: "/locations", label: "The world map of cinema" },
    ],
  },
  person: {
    intro: "More of the people behind the camera.",
    browse: { href: "/credits", label: "Browse credited people" },
    crossLinks: [
      { href: "/director", label: "The director hubs" },
      { href: "/film", label: "The full film index" },
    ],
  },
};

async function siblingsFor(kind: HubKind, slug: string): Promise<HubLink[]> {
  try {
    switch (kind) {
      case "genre": return await genreSiblings(slug);
      case "lineage": return await lineageSiblings(slug);
      case "frame": return await frameSiblings(slug);
      case "tradition": return await traditionSiblings(slug);
      default: return []; // movement / person: no cheap sibling source — browse + cross-links carry the footer
    }
  } catch {
    return []; // siblings are optional; never fail the page for them
  }
}

export function hubExploreData(kind: HubKind, slug: string): Promise<HubExplore> {
  return unstable_cache(
    async (): Promise<HubExplore> => {
      const meta = KIND_META[kind];
      const siblings = await siblingsFor(kind, slug);
      return { intro: meta.intro, siblings, browse: meta.browse, crossLinks: meta.crossLinks };
    },
    ["hub-explore-1", kind, slug],
    { revalidate: 86400 },
  )();
}
