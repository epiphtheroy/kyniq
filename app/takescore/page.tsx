import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ScreenerExplorer, { type ScrRow, type DimHist } from "@/components/screener/ScreenerExplorer";
import { filmUrl } from "@/lib/urls";
import { CODEX_DIMS, takescoreDimUrl, type CodexDimGroup } from "@/lib/cinecodex_dims";
import "./screener.css";

export const revalidate = 300;

const SITE = "https://metatake.net";
const TITLE = "TakeScore Screener — every film scored on durable value, not popularity";
const DESC =
  "The Screener: search any film for its TakeScore (with IMDb, RT and Metascore), pin and compare several at once, and screen 6,701 scored films by year, country, your streaming services, the thirteen sub-dimensions, and what you haven't seen. One-tap to your list.";

export const metadata: Metadata = {
  alternates: { canonical: "/takescore" },
  title: TITLE,
  description: DESC,
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// The 13 global dimension distributions are static (change only on a rescore) —
// cache a day so the brush minis cost nothing on the hot path.
const cachedDimHist = unstable_cache(
  async (): Promise<DimHist> => {
    const { data } = await db().rpc("cinecodex_dim_histograms");
    return (data as DimHist | null) ?? {};
  },
  ["cinecodex-dim-hist-1"],
  { revalidate: 86400 },
);

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TakeScorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Seed the client instrument from the URL on the server, so the hero + first
  // grid page are in the SSR HTML (no useSearchParams → no Suspense fallback).
  const initialParams = {
    sort: one(sp.sort) || "u", lam: one(sp.lam), since: one(sp.since), to: one(sp.to),
    country: one(sp.country), q: one(sp.q), ts: one(sp.ts), dims: one(sp.dims),
    mv: one(sp.mv), hide: one(sp.hide), pin: one(sp.pin),
  };
  const [{ data: page }, { data: cc }, dimHist] = await Promise.all([
    db().rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 500, p_offset: 0 }),
    db().rpc("cinecodex_countries"),
    cachedDimHist(),
  ]);
  const res = (page as { total: number; rows: ScrRow[] } | null) ?? { total: 0, rows: [] };
  const countries = (cc as { code: string; n: number }[] | null) ?? [];
  const ranked = res.rows;

  // #1 film's backdrop drives the black hero (deterministic → stable ISR cache).
  const topSlug = ranked[0]?.slug ?? null;
  const { data: hero } = topSlug
    ? await db().from("films").select("title, backdrop_path").eq("slug", topSlug).maybeSingle()
    : { data: null };
  const heroBackdrop = (hero as { backdrop_path: string | null } | null)?.backdrop_path ?? null;
  const heroFilm = (hero as { title: string } | null)?.title ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${SITE}/takescore`, url: `${SITE}/takescore`, name: TITLE, description: DESC },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "TakeScore", item: `${SITE}/takescore` },
      ] },
      { "@type": "ItemList", itemListOrder: "https://schema.org/ItemListOrderAscending",
        ...(res.total ? { numberOfItems: res.total } : {}),
        itemListElement: ranked.slice(0, 25).map((r, i) => ({
          "@type": "ListItem", position: i + 1,
          name: r.year ? `${r.title} (${r.year})` : r.title,
          url: `${SITE}${filmUrl(r.slug)}`,
        })) },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <ScreenerExplorer
        initialRows={ranked.slice(0, 60)} initialTotal={res.total} countries={countries}
        dimHist={dimHist} heroBackdrop={heroBackdrop} heroFilm={heroFilm} initialParams={initialParams}
      />


      <div className="mt-wrap lh">
        {/* The 13 dimension landing pages — each answers one search-shaped
            question with an essay, the 8-anchor ruler and a top-25 list. */}
        <section aria-labelledby="ts-dims" style={{ marginTop: 48 }}>
          <h2 className="df-h2" id="ts-dims">The thirteen dimensions</h2>
          <p className="df-sub">
            Every TakeScore is built from thirteen sub-scores in three groups — what a film gives back (Value), what
            it takes to unlock (Cost), and how it can go wrong (Risk). Each dimension has its own page: what it
            measures, the eight-anchor calibration ruler, and the catalog&apos;s top 25.
          </p>
          {(
            [
              ["value", "Value — what you keep"],
              ["cost", "Cost — what it takes"],
              ["risk", "Risk — what can go wrong"],
            ] as [CodexDimGroup, string][]
          ).map(([g, heading]) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <h3 className="ab-h2" style={{ fontSize: 16, margin: "12px 0 4px" }}>{heading}</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {CODEX_DIMS.filter((d) => d.group === g).map((d) => (
                  <li key={d.slug} className="ab-p" style={{ margin: "3px 0" }}>
                    <Link href={takescoreDimUrl(d.slug)}>{d.question}</Link>{" "}
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--muted)" }}>{d.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="df-sub" style={{ marginTop: 8 }}><Link href="/takescore/about">How the TakeScore works →</Link></p>
        </section>

        {/* Crawlable ranking — the explorer above is client-paginated, so this
            plain server-rendered list is the crawl backbone (same model as the
            credits A–Z). */}
        <section aria-labelledby="ts-full" style={{ marginTop: 48 }} className="mtl-swap-out">
          <h2 className="df-h2" id="ts-full">The full ranking</h2>
          <p className="df-sub">
            The top {ranked.length.toLocaleString()} films by TakeScore
            {res.total > ranked.length ? ` of ${res.total.toLocaleString()} scored` : ""} — each links to the film
            page, where the full sub-scores live.
          </p>
          <div className="th-grid">
            {ranked.map((r, i) => (
              <a className="th-row" key={r.slug} href={filmUrl(r.slug)}>
                <span className="th-n" style={{ marginLeft: 0 }}>{i + 1}</span>
                <span className="th-name">{r.title}{r.year ? ` (${r.year})` : ""}</span>
              </a>
            ))}
          </div>
        </section>

        <p className="df-sub" style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
          Streaming availability via TMDB (data licensed through JustWatch). External ratings via IMDb, Rotten Tomatoes and Metacritic.
        </p>
      </div>
    </div>
  );
}
