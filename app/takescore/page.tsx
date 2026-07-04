import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import CodexExplorer, { type CodexRow } from "@/components/CodexExplorer";
import { filmUrl } from "@/lib/urls";
import { CODEX_DIMS, takescoreDimUrl, type CodexDimGroup } from "@/lib/cinecodex_dims";

export const revalidate = 300;

const SITE = "https://metatake.net";
const TITLE = "TakeScore — films ranked by durable value, not popularity";
const DESC =
  "The TakeScore (TS): our own estimate of the durable value a serious viewer gains from a film, the cost to unlock it, and the risk it disappoints. Search, filter by country, decade and by any of the thirteen sub-dimensions, and dial your risk-aversion.";

export const metadata: Metadata = {
  alternates: { canonical: "/takescore" },
  title: TITLE,
  description: DESC,
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function TakeScorePage() {
  // One ranked fetch serves both surfaces: the explorer takes the first 60
  // (its load-more offset starts at initialRows.length), and the crawlable
  // "full ranking" below renders the whole page of 500.
  const [{ data: page }, { data: cc }] = await Promise.all([
    db().rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 500, p_offset: 0 }),
    db().rpc("cinecodex_countries"),
  ]);
  const res = (page as { total: number; rows: CodexRow[] } | null) ?? { total: 0, rows: [] };
  const countries = (cc as { code: string; n: number }[] | null) ?? [];
  const ranked = res.rows;

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
      <div className="mt-wrap lh">
        <h1 className="lh-h1">TakeScore</h1>
        <p className="lh-def">
          Every film gets a <span className="term">TakeScore</span> (TS) — our estimate of the durable value a serious
          viewer gains, the cost to unlock it and the risk it disappoints. Ranked by TakeScore, not popularity. Search,
          set a range on any dimension, dial your risk-aversion, and click any film to open its scores in place.{" "}
          <Link href="/takescore/about">How it works →</Link>
        </p>
        <CodexExplorer initialRows={ranked.slice(0, 60)} initialTotal={res.total} countries={countries} />

        {/* The 13 dimension landing pages — each answers one search-shaped
            question with an essay, the 8-anchor ruler and a top-25 list. */}
        <section aria-labelledby="ts-dims" style={{ marginTop: 56 }}>
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
        </section>

        {/* Crawlable ranking — the explorer above is client-paginated, so this
            plain server-rendered list is the crawl backbone (same model as the
            credits A–Z). */}
        <section aria-labelledby="ts-full" style={{ marginTop: 56 }}>
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
      </div>
    </div>
  );
}
