import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import Byline from "@/components/Byline";
import RecordToc from "@/components/read/RecordToc";
import TakeScoreBoxes from "@/components/read/TakeScoreBoxes";
import { cachedRankedScores } from "@/lib/takescore-bulk";
import { displayTs } from "@/lib/cinecodex_dims";
import DirectorPlates from "@/components/read/DirectorPlates";
import ShareDock from "@/components/ShareDock";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/takescore — "Every {Director} Film, Scored" (2026-07-09):
 * the whole visible filmography ranked by TakeScore (U = Value − λ·Risk,
 * λ = 1), one cinecodex_card per film. LLM-0: every sentence is assembled from
 * card fields — scores, tiers, counts, ranks, titles, years. No evaluative
 * language beyond the stored tier word; the numbers make the argument.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const SITE = "https://metatake.net";
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Film = { id: string; slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null };

/** The slice of cinecodex_card this page consumes (full shape: /takescore/film/[slug]). */
type Card = {
  slug: string; title: string; year: number | null; poster_path: string | null;
  v: number; c: number; r: number; u: number;
  rank: number | null; rank_total: number | null;
  tier: string | null; n_takes: number | null;
};

async function loadUncached(slug: string) {
  const supabase = db();
  const [{ data: films, error: filmsErr }, { data: dir }, { count: picksCount }, { data: factsRow }] = await Promise.all([
    supabase.from("films").select("id, slug, title, year, director, backdrop_path, poster_path").eq("director_slug", slug).eq("visible", true).order("year"),
    supabase.from("directors").select("name").eq("slug", slug).maybeSingle(),
    supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
    supabase.from("director_facts").select("facts").eq("director_slug", slug).maybeSingle(),
  ]);
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  const filmArr = films as Film[];
  const director = (dir?.name as string | undefined) || filmArr[0].director || slug.replace(/-/g, " ");

  // Scores from the shared bulk ranking (one fast cached corpus query) — a
  // per-film cinecodex_card loop recomputes corpus-wide rank each call and
  // starved Postgres into statement timeouts (500s — Vercel logs 2026-07-09).
  const { scores: bulkScores, total: rankTotal } = await cachedRankedScores();
  const cards: Card[] = [];
  for (const f of filmArr) {
    const b = bulkScores[f.slug];
    if (b) cards.push({
      slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path,
      v: b.v, c: b.c, r: b.r, u: b.u, rank: b.rank, rank_total: rankTotal, tier: null, n_takes: null,
    });
  }
  if (cards.length === 0) return null;

  // The ranking: U desc; ties broken by site rank, then title — deterministic.
  cards.sort((a, b) =>
    b.u - a.u ||
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title)
  );

  const factsArr = (factsRow?.facts ?? null) as { n: number }[] | null;
  const native = await directorNative(director);

  return {
    director, native,
    films: filmArr,
    cards,
    picksCount: picksCount ?? 0,
    factsCount: Array.isArray(factsArr) ? factsArr.length : 0,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-takescore-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

interface Props { params: Promise<{ slug: string }> }

const yStr = (y: number | null) => (y ? ` (${y})` : "");
const trim158 = (s: string) => (s.length <= 158 ? s : s.slice(0, 155).replace(/\s+\S*$/, "") + "…");

function pageTitle(d: Data): string {
  return `Every ${d.director} Film, Scored — TakeScore Ranking of ${d.cards.length} Films`;
}

function pageDescription(d: Data): string {
  const [top, second] = d.cards;
  const n = d.cards.length;
  return trim158(
    `${d.director}'s ${n} scored film${n === 1 ? "" : "s"}, ranked by TakeScore — ${top.title} leads at ${displayTs(top.u)}` +
    `${second ? `; ${second.title} follows at ${displayTs(second.u)}` : ""}. Value minus risk, on a 0–100 scale.`
  );
}

/** One deterministic sentence per film — the numbers already sit in the boxes
 *  above it, so the prose reads the score, it doesn't just repeat the digits. */
function cardSentence(c: Card): string {
  const parts: string[] = [];
  if (c.rank != null && c.rank_total != null) parts.push(`Ranked #${c.rank} of ${c.rank_total} films on Metatake`);
  if (c.n_takes != null && c.n_takes > 0) parts.push(`${parts.length ? "on " : "On "}${c.n_takes} close reading${c.n_takes === 1 ? "" : "s"}`);
  // Read the shape of the score, from the fields only (no evaluation beyond tier).
  const shape = c.v >= c.r + 20 ? "value clears its risk with room to spare"
    : c.v >= c.r ? "value edges out the risk"
    : "the risk runs close to the value";
  parts.push(`its ${c.tier ? `${c.tier.toLowerCase()} ` : ""}score of ${displayTs(c.u)} means ${shape}`);
  return parts.join(" — ") + ".";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = pageTitle(data);
  const description = pageDescription(data);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: `${SITE}/about` }],
    alternates: { canonical: `/director/${slug}/takescore` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.cards.length >= 3),
  };
}

export default async function DirectorTakescorePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, native, films, cards, picksCount, factsCount } = data;

  const n = cards.length;
  const top = cards[0];
  const second = cards[1] ?? null;
  const bottom = cards[n - 1];
  const maxU = displayTs(top.u);
  const minU = displayTs(bottom.u);
  const gap = maxU - minU;
  const meanU = displayTs(cards.reduce((a, c) => a + c.u, 0) / n);

  const filmBySlug = new Map(films.map((f) => [f.slug, f]));

  // Hero backdrop: the top-scored film's still, else the best-ranked film with art.
  const heroCard = cards.find((c) => filmBySlug.get(c.slug)?.backdrop_path) ?? null;
  const heroFilm = heroCard ? filmBySlug.get(heroCard.slug)! : null;
  const heroBd = heroFilm?.backdrop_path ?? null;

  // Scored-span years, from the cards themselves.
  const years = cards.map((c) => c.year).filter((y): y is number => typeof y === "number");
  const minY = years.length ? Math.min(...years) : null;
  const maxY = years.length ? Math.max(...years) : null;
  const spanLabel = minY != null && maxY != null ? (minY === maxY ? `${minY}` : `${minY}–${maxY}`) : null;

  // Tier distribution — the stored tier words, counted.
  const tierCounts = new Map<string, number>();
  for (const c of cards) if (c.tier) tierCounts.set(c.tier, (tierCounts.get(c.tier) ?? 0) + 1);
  const tiers = [...tierCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Mid-article stills: the filmography's backdrops in year order (the films
  // query is year-sorted — deterministic), hero excluded; one every 3 ranks.
  const stills = films.filter((f) => f.backdrop_path && f.slug !== heroFilm?.slug);

  // Films without a card yet — completes the filmography, deterministically.
  const scoredSlugs = new Set(cards.map((c) => c.slug));
  const unscored = films.filter((f) => !scoredSlugs.has(f.slug));

  const title = pageTitle(data);
  const description = pageDescription(data);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Directors", item: `${SITE}/director` },
      { "@type": "ListItem", position: 3, name: director, item: `${SITE}/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "TakeScore", item: `${SITE}/director/${slug}/takescore` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Every ${director} film, ranked by TakeScore`,
    numberOfItems: n,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Movie",
        name: c.title,
        url: `${SITE}/film/${c.slug}`,
        ...(c.year ? { datePublished: String(c.year) } : {}),
        ...(c.poster_path ? { image: `${IMG}/w500${c.poster_path}` } : {}),
      },
    })),
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE}/director/${slug}/takescore`,
    headline: title,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `${SITE}/director/${slug}` },
    author: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake", url: SITE },
    editor: { "@type": "Person", "@id": `${SITE}/editor#person`, name: "Wonwoo Yoon", url: `${SITE}/editor` },
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake" },
  };

  const hasDoors = picksCount > 0 || factsCount > 0;
  let stillIdx = 0;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the ranking, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>TakeScore</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">TakeScore™</span>
              <span className="rd-meta">{n} film{n === 1 ? "" : "s"} scored · top {maxU}</span>
            </div>
            <h1 className="rd-h1">
              Every {director} Film, Scored
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              {top.title}{yStr(top.year)} leads the filmography at {maxU}
              {second ? <>; {second.title}{yStr(second.year)} follows at {displayTs(second.u)}</> : null}.
              {" "}TakeScore = Value − Risk on a 0–100 scale — the {n === 1 ? "one scored film" : `${n} scored films`}, ranked below, best first.
            </p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/director/${slug}/takescore`} title={title} hook={description} />
              <ShareDock variant="fab" path={`/director/${slug}/takescore`} title={title} hook={description} />
            </div>
          </div>
          {heroBd && heroFilm ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroBd}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {heroFilm.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            <p>
              {director} has {films.length} film{films.length === 1 ? "" : "s"} on Metatake; {n === films.length ? (n === 1 ? "it carries" : "all of them carry") : `${n} of them carr${n === 1 ? "ies" : "y"}`} a{" "}
              <Link href="/takescore/about">TakeScore</Link> — Value minus Risk, each scored 0–100 against the fixed
              TakeScore rubric, with entry cost kept apart as a price, never a merit. This page is the whole scored
              filmography in one ranking, best first. Assembled by Metatake Editorial, edited by{" "}
              <Link href="/editor">Wonwoo Yoon</Link>.
            </p>

            <div className="lin-stats">
              <span className="lin-stat" style={{ "--sc": "#B8863B" } as CSSProperties}>{n} film{n === 1 ? "" : "s"} scored</span>
              <span className="lin-stat" style={{ "--sc": "#0F6E56" } as CSSProperties}>mean {meanU}</span>
              {spanLabel ? <span className="lin-stat" style={{ "--sc": "#5a6b86" } as CSSProperties}>{spanLabel}</span> : null}
              {tiers.map(([tier, count]) => (
                <span className="lin-stat" style={{ "--sc": "#8a8f98" } as CSSProperties} key={tier}>{tier} ×{count}</span>
              ))}
            </div>

            {n >= 2 ? (
              <p>
                The spread: from {top.title}{yStr(top.year)} at {maxU} down to {bottom.title}{yStr(bottom.year)} at{" "}
                {minU} — a gap of {gap} point{gap === 1 ? "" : "s"} across the scored work.
              </p>
            ) : null}

            {cards.map((c, i) => {
              const film = filmBySlug.get(c.slug);
              const poster = c.poster_path ?? film?.poster_path ?? null;
              const still = i > 0 && i % 3 === 0 && stillIdx < stills.length ? stills[stillIdx++] : null;
              return (
                <section key={c.slug} id={`rank-${i + 1}`}>
                  {still ? (
                    <figure className={`rd-fig${(stillIdx % 2 === 0) ? " rd-fig--inset" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/w780${still.backdrop_path}`} alt={`${still.title} still`} loading="lazy" width={780} height={439} />
                      <figcaption>{still.title}{yStr(still.year)} · via TMDB</figcaption>
                    </figure>
                  ) : null}
                  <h2>{i + 1}. {c.title}{yStr(c.year)}</h2>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    {poster ? (
                      <Link href={`/film/${c.slug}`} style={{ flex: "0 0 auto" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w185${poster}`} alt={`${c.title} poster`} width={110} height={165} loading="lazy" style={{ width: 110, height: 165, objectFit: "cover", borderRadius: 8, display: "block", background: "#e8e4da" }} />
                      </Link>
                    ) : null}
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      {/* Numbers first — the boxed scorecard, then the prose reads it. */}
                      <div style={{ margin: "0 0 10px" }}><TakeScoreBoxes s={c} /></div>
                      <p style={{ marginTop: 0 }}>{cardSentence(c)}</p>
                      <p style={{ fontSize: "0.92em" }}>
                        <Link href={`/takescore/film/${c.slug}`}>Full scorecard →</Link>
                        {" · "}
                        <Link href={`/film/${c.slug}`}>Open {c.title} on Metatake</Link>
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}

            {unscored.length > 0 ? (
              <>
                <hr />
                <h2>Not yet scored</h2>
                <p>
                  The ranking covers {n} of {director}&apos;s {films.length} film{films.length === 1 ? "" : "s"} on
                  Metatake. Still awaiting a TakeScore:{" "}
                  {unscored.map((f, i) => (
                    <span key={f.slug}>
                      {i > 0 ? " · " : ""}
                      <Link href={`/film/${f.slug}`}>{f.title}</Link>
                      {f.year ? ` (${f.year})` : ""}
                    </span>
                  ))}
                  .
                </p>
              </>
            ) : null}

            {hasDoors ? (
              <div className="rec-tocs">
                {picksCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/start`}
                    kicker="The route in"
                    title={`Where to start with ${director} — the route, argued`}
                    rows={[
                      { label: "Route stops", value: picksCount },
                      { label: "Films scored", value: n },
                    ]}
                    cta="Open the route"
                  />
                ) : null}
                {factsCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/life`}
                    kicker="The life"
                    title={`Who is ${director}? — every researched moment, sourced`}
                    rows={[
                      { label: "Researched moments", value: factsCount },
                      { label: "Films on Metatake", value: films.length },
                    ]}
                    cta="Read the life"
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
            Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> ·{" "}
            <Link href="/methodology">How we work →</Link> ·{" "}
            <Link href="/takescore/about">How the TakeScore works →</Link>
          </p>
          <p style={{ marginTop: 18 }}>
            <Link href={`/director/${slug}`}>← {director} on Metatake: films, readings &amp; the full filmography</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="takescore" />
    </div>
  );
}
