import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import MarqueeExplorer from "@/components/marquee/MarqueeExplorer";
import type { ScrRow, Country } from "@/components/screener/ScreenerExplorer";
import { filmUrl } from "@/lib/urls";
import "../takescore/screener.css";
import "./marquee.css";

export const revalidate = 300;

const SITE = "https://metatake.net";
const TITLE = "What to Watch — the best on your streaming services, ranked by TakeScore";
const DESC =
  "The Marquee: tell us your country and the services you pay for, and we rank the best films you can actually watch right now — by durable TakeScore, not by what's trending. Every row shows how to watch it (streaming, free, or rent), with a VPN multi-country mode and free US-library (Kanopy/Hoopla) sources.";

export const metadata: Metadata = {
  alternates: { canonical: "/what-to-watch" },
  title: TITLE,
  description: DESC,
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Country labels are computed on the SERVER and passed as strings, so the client
// never calls Intl.DisplayNames at render (Node vs browser ICU → hydration #418).
let _rn: Intl.DisplayNames | null = null;
const cname = (cc: string) => { try { _rn = _rn || new Intl.DisplayNames(["en"], { type: "region" }); return _rn.of(cc.toUpperCase()) || cc.toUpperCase(); } catch { return cc.toUpperCase(); } };
const flag = (cc: string) => cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

// Kept static/ISR (no searchParams): the hero + a global top-TakeScore grid render
// server-side as the crawl backbone; MarqueeExplorer reads localStorage prefs on
// mount and re-ranks to the visitor's country/services (invariant: SSR is global).
export default async function WhatToWatchPage() {
  const [{ data: page }, { data: wc }] = await Promise.all([
    db().rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 120, p_offset: 0 }),
    db().rpc("wtw_countries"),
  ]);
  const res = (page as { total: number; rows: ScrRow[] } | null) ?? { total: 0, rows: [] };
  const wcRows = (wc as { code: string; n_films: number; n_prov: number }[] | null) ?? [];
  const countries: Country[] = wcRows.map((c) => ({ code: c.code, n: c.n_films, label: `${flag(c.code)} ${cname(c.code)} (${c.n_films})` }));
  const ranked = res.rows;

  const topSlug = ranked[0]?.slug ?? null;
  const { data: hero } = topSlug
    ? await db().from("films").select("title, backdrop_path").eq("slug", topSlug).maybeSingle()
    : { data: null };
  const heroBackdrop = (hero as { backdrop_path: string | null } | null)?.backdrop_path ?? null;
  const heroFilm = (hero as { title: string } | null)?.title ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${SITE}/what-to-watch`, url: `${SITE}/what-to-watch`, name: TITLE, description: DESC },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "What to Watch", item: `${SITE}/what-to-watch` },
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

      <MarqueeExplorer
        initialRows={ranked.slice(0, 60)} initialTotal={res.total}
        countries={countries} heroBackdrop={heroBackdrop} heroFilm={heroFilm}
      />

      <div className="mt-wrap lh">
        {/* How it differs from Where to watch — one paragraph, for readers and crawlers. */}
        <section aria-labelledby="mq-about" style={{ marginTop: 40 }}>
          <h2 className="df-h2" id="mq-about">How this works</h2>
          <p className="df-sub">
            <b>What to Watch</b> starts from your subscriptions: choose your country and the services you pay for,
            and the page ranks the best films available to you by <Link href="/takescore">TakeScore</Link> — our
            measure of durable value, not popularity. Its sister menu,{" "}
            <Link href="/where-to-watch">Where to watch</Link>, goes the other way: start from a film you already
            have in mind and find where it streams. Turn on <b>VPN</b> to fold in other countries’ catalogues, or{" "}
            <b>US library</b> to include the free Kanopy and Hoopla sources a participating library card unlocks.
          </p>
        </section>

        {/* Crawlable ranking — the explorer above is client-paginated, so this plain
            server-rendered list is the crawl backbone. */}
        <section aria-labelledby="mq-full" style={{ marginTop: 40 }} className="mtl-swap-out">
          <h2 className="df-h2" id="mq-full">Top films to watch, by TakeScore</h2>
          <p className="df-sub">
            The top {ranked.length.toLocaleString("en-US")} films by TakeScore
            {res.total > ranked.length ? ` of ${res.total.toLocaleString("en-US")} scored` : ""} — set your services
            above to see which you can stream now.
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
          Streaming availability via TMDB (data licensed through JustWatch). VPN and library results are shown for
          reference — check each service’s terms. External ratings via IMDb, Rotten Tomatoes and Metacritic.
        </p>
      </div>
    </div>
  );
}
