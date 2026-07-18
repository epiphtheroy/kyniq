import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import Byline from "@/components/Byline";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import ShareDock from "@/components/ShareDock";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/life — "Who is X?" as its own indexable page.
 * The director page keeps a teaser (first facts + link here); this page is
 * the full researched life: name meaning, intro, every sourced fact.
 * Promoted to the article grammar (2026-07-09): dark film hero, stat chips,
 * anchored facts, "The films" context block, and RecordToc doors to the
 * sibling start/next articles.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

type Fact = { n: number; text: string; source?: string | null };
type FactsRow = { director_slug: string; name_meaning: string | null; intro: string | null; facts: Fact[] };
type FilmRow = { slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null };

function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const [{ data: facts, error: factsErr }, { data: d }, { data: films }, { count: pickCount }, { count: nextCount }] = await Promise.all([
        supabase.from("director_facts").select("director_slug, name_meaning, intro, facts").eq("director_slug", slug).maybeSingle(),
        supabase.from("directors").select("name, profile_path, birthday, place_of_birth").eq("slug", slug).maybeSingle(),
        supabase.from("films").select("slug, title, year, director, backdrop_path").eq("director_slug", slug).eq("visible", true).order("year"),
        supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
        supabase.from("director_next").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
      ]);
      // Throw on a DB error (never cache a poison 404 during a Supabase outage).
      if (factsErr) throw new Error(`director facts(${slug}): ${factsErr.message}`);
      if (!facts || !Array.isArray(facts.facts) || facts.facts.length === 0) return null;
      const director = d?.name || (films as FilmRow[] | null)?.[0]?.director || slug.replace(/-/g, " ");
      return {
        facts: facts as FactsRow,
        d,
        films: ((films as FilmRow[] | null) ?? []),
        director,
        pickCount: pickCount ?? 0,
        nextCount: nextCount ?? 0,
      };
    },
    // v2: payload gained films' backdrop_path + pick/next head counts (2026-07-09 promotion)
    ["director-life-2", slug],
    { revalidate: 3600, tags: [`director:${slug}`] },
  )();
}

interface Props { params: Promise<{ slug: string }> }

function hostOf(src?: string | null): string {
  try { if (src) return new URL(src).hostname.replace(/^www\./, ""); } catch {}
  return "";
}

/** Deterministic first sentence of a curated intro (dek material). */
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.director);
  const n = data.facts.facts.length;
  const title = `Who Is ${data.director}${native ? ` (${native})` : ""}? — ${n} Researched Moments from the Life`;
  const description = data.facts.intro
    ? data.facts.intro.slice(0, 155)
    : `${n} verified moments from ${data.director}'s life — each one checked against a live source. The person behind the films.`;
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/life` },
    openGraph: { title, description, type: "profile" },
    robots: pageRobots(n >= 4),
  };
}

export default async function DirectorLifePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { facts, d, films, director, pickCount, nextCount } = data;
  const native = await directorNative(director);
  const sorted = facts.facts.slice().sort((a, b) => a.n - b.n);
  const n = sorted.length;

  const hostCount = new Set(sorted.map((f) => hostOf(f.source)).filter(Boolean)).size;
  const bornYear = d?.birthday ? d.birthday.slice(0, 4) : null;

  // Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.6). The ONLY
  // distinct crisp fact this near-single-purpose ("Who is X?") page doesn't
  // already headline: the precise birthdate. The stat chip above shows the
  // birth YEAR only, so a full date + place is additive, not a restatement
  // (§0-4). name_meaning is deliberately NOT surfaced here — the dr-namemean
  // callout below carries it verbatim, so a QA item would duplicate it.
  const bornLabel = (() => {
    if (!d?.birthday) return null;
    const dt = new Date(d.birthday);
    return isNaN(dt.getTime())
      ? d.birthday
      : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  })();
  const lifeQuickAnswers: QuickAnswerItem[] = bornLabel
    ? [{
        q: `When and where was ${director} born?`,
        a: `${director} was born ${bornLabel}${d?.place_of_birth ? ` in ${d.place_of_birth}` : ""}.`,
      }]
    : [];
  const heroFilm = films.find((f) => f.backdrop_path) ?? null;
  const dated = films.filter((f) => f.year != null);

  // Mid-article stills: the fact list breaks every 6 moments for a backdrop
  // from the filmography (year order — the films query is year-ordered — hero
  // excluded, max 3 stills). Numbering carries across segments via <ol start>.
  const FACTS_PER_SEGMENT = 6;
  const segments: Fact[][] = [];
  for (let i = 0; i < sorted.length; i += FACTS_PER_SEGMENT) segments.push(sorted.slice(i, i + FACTS_PER_SEGMENT));
  const lifeStills = films.filter((f) => f.backdrop_path && f.slug !== heroFilm?.slug).slice(0, 3);

  const metaLine = [
    `${n} moment${n === 1 ? "" : "s"}`,
    hostCount ? `${hostCount} source${hostCount === 1 ? "" : "s"}` : null,
    films.length ? `${films.length} film${films.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");

  const dek = facts.intro
    ? firstSentence(facts.intro)
    : `${n} verified moments from ${director}'s life — each one checked against a live source. The person behind the films.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `Who Is ${director}?`,
    url: `https://metatake.net/director/${slug}/life`,
    mainEntity: {
      "@type": "Person",
      name: director,
      ...(native ? { alternateName: native } : {}),
      jobTitle: "Film director",
      ...(d?.birthday ? { birthDate: d.birthday } : {}),
      ...(d?.place_of_birth ? { birthPlace: d.place_of_birth } : {}),
      ...(d?.profile_path ? { image: `${IMG}/w342${d.profile_path}` } : {}),
      url: `https://metatake.net/director/${slug}`,
    },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "The Life", item: `https://metatake.net/director/${slug}/life` },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* ── Dark hero: the life, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>The Life</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip"><Link href="/curious" style={{ color: "inherit", textDecoration: "none" }}>The Directors Desk</Link></span>
              <span className="rd-meta">{metaLine}</span>
            </div>
            <h1 className="rd-h1">
              Who is {director}{native ? <span style={{ fontWeight: 400, opacity: 0.6 }}> ({native})</span> : null}?
            </h1>
            <p className="rd-dek">{dek}</p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/director/${slug}/life`} title={`Who is ${director}?`} hook={dek} />
              <ShareDock variant="fab" path={`/director/${slug}/life`} title={`Who is ${director}?`} hook={dek} />
            </div>
          </div>
          {heroFilm?.backdrop_path ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroFilm.backdrop_path}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {heroFilm.title}{heroFilm.year ? ` (${heroFilm.year})` : ""} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            <div className="lin-stats" style={{ marginTop: 14 }}>
              <span className="lin-stat" style={{ "--sc": "#B8863B" } as CSSProperties}>{n} moment{n === 1 ? "" : "s"}</span>
              {hostCount ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as CSSProperties}>{hostCount} source{hostCount === 1 ? "" : "s"}</span> : null}
              {films.length ? <span className="lin-stat" style={{ "--sc": "#12897A" } as CSSProperties}>{films.length} film{films.length === 1 ? "" : "s"}</span> : null}
              {bornYear ? (
                <span className="lin-stat" style={{ "--sc": "#5A6B86" } as CSSProperties}>
                  Born {bornYear}{d?.place_of_birth ? ` · ${d.place_of_birth}` : ""}
                </span>
              ) : null}
            </div>

            {d?.profile_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${IMG}/w185${d.profile_path}`}
                alt={director}
                width={110}
                height={165}
                style={{ float: "right", margin: "4px 0 10px 16px", borderRadius: 8, objectFit: "cover" }}
              />
            ) : null}

            <QuickAnswers items={lifeQuickAnswers} />

            {facts.name_meaning ? (
              <div className="dr-namemean" style={{ margin: "18px 0" }}>
                <span className="dr-nm-k">The name</span>
                <p>{facts.name_meaning}</p>
              </div>
            ) : null}

            {facts.intro ? <p className="dr-life-intro" style={{ fontSize: 17, lineHeight: 1.65 }}>{facts.intro}</p> : null}

            {n >= 10 ? (
              <p style={{ fontSize: "0.9em", opacity: 0.75 }}>
                <b>Jump to:</b>{" "}
                {sorted.map((f, i) => (
                  <span key={f.n}>
                    {i > 0 ? " · " : ""}
                    <a href={`#m${f.n}`}>{f.n}</a>
                  </span>
                ))}
              </p>
            ) : null}

            {segments.map((seg, si) => {
              const still = si < segments.length - 1 ? lifeStills[si] : undefined;
              return (
                <Fragment key={seg[0].n}>
                  <ol className="dr-life-list" start={si * FACTS_PER_SEGMENT + 1}>
                    {seg.map((f) => {
                      const host = hostOf(f.source);
                      return (
                        <li key={f.n} id={`m${f.n}`} className="dr-fact">
                          {f.text}
                          {f.source ? <> <a className="dr-fact-src" href={f.source} target="_blank" rel="noopener nofollow" title={f.source}>↗ {host}</a></> : null}
                        </li>
                      );
                    })}
                  </ol>
                  {still ? (
                    <figure className="rd-fig">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/w780${still.backdrop_path}`} alt={`${still.title} still`} width={780} height={439} loading="lazy" />
                      <figcaption>{still.title}{still.year ? ` (${still.year})` : ""} · via TMDB</figcaption>
                    </figure>
                  ) : null}
                </Fragment>
              );
            })}
            <div className="dr-src">Each fact is written freely, then verified against a live web source (English &amp; native-language). Source link per fact.</div>

            {films.length ? (
              <section style={{ clear: "both" }}>
                <h2>The films</h2>
                <p>
                  The life above runs through {films.length} film{films.length === 1 ? "" : "s"} on Metatake
                  {dated.length > 1 ? <>, {dated[0].year} to {dated[dated.length - 1].year}</> : null}:{" "}
                  {films.map((f, i) => (
                    <span key={f.slug}>
                      {i > 0 ? " · " : ""}
                      <Link href={`/film/${f.slug}`}>{f.title}{f.year ? ` (${f.year})` : ""}</Link>
                    </span>
                  ))}
                </p>
              </section>
            ) : null}
          </div>

          {pickCount > 0 || nextCount > 0 ? (
            <div className="rec-tocs">
              {pickCount > 0 ? (
                <RecordToc
                  href={`/director/${slug}/start`}
                  kicker="The route"
                  title={`Where to start with ${director}`}
                  rows={[{ label: "Route stops", value: pickCount }]}
                  cta="Follow the route"
                />
              ) : null}
              {nextCount > 0 ? (
                <RecordToc
                  href={`/director/${slug}/next`}
                  kicker="Keep going"
                  title={`After ${director}: who to watch next`}
                  rows={[{ label: "Recommendations", value: nextCount }]}
                  cta="Meet them"
                />
              ) : null}
            </div>
          ) : null}

          <p style={{ marginTop: 26 }}>
            <Link className="rcp-h" href={`/director/${slug}`}>← {director} on Metatake: films, readings &amp; where to start</Link>
          </p>

          <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
            Researched by Metatake AI, each fact sourced · designed by <Link href="/editor">Wonwoo Yoon</Link> · <Link href="/methodology">How we work →</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="life" />
    </div>
  );
}
