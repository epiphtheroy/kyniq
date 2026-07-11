import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import Byline from "@/components/Byline";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import { FAMILIES, fw } from "@/lib/frameworks";
import { directorNative } from "@/lib/nativeName";
import { pageRobots } from "@/lib/seo";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/misreadings — every Strong Misreading of a director's films,
 * gathered into one article (2026-07-09). The director hub shows only a
 * representative 8; this is the complete set, grouped by framework family,
 * with its own indexable, searchable URL. LLM-free: every sentence is stored
 * corpus data (take_title + rationale per reading). Mirrors the film-centric
 * /film/[slug]/misreadings, one level up.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Reading = {
  framework: string | null; take_title: string | null; rationale: string | null; strength: number | null;
  figure_label: string | null; figure_slug: string | null; film_title: string; film_slug: string; film_year: number | null;
};

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: films, error: filmsErr } = await supabase
    .from("films").select("id, slug, title, year, director, backdrop_path, poster_path")
    .eq("director_slug", slug).eq("visible", true).order("year");
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  const director = (films[0].director as string) ?? slug.replace(/-/g, " ");

  const [{ data: rd }, { count: picksCount }, { data: factsRow }] = await Promise.all([
    supabase.rpc("director_misreadings", { p_slug: slug, p_limit: 600 }),
    supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
    supabase.from("director_facts").select("facts").eq("director_slug", slug).maybeSingle(),
  ]);
  const readings = (rd as Reading[] | null) ?? [];
  if (readings.length === 0) return null;

  const factsArr = (factsRow?.facts ?? null) as unknown[] | null;
  return {
    director,
    films: films as { id: string; slug: string; title: string; year: number | null; backdrop_path: string | null; poster_path: string | null }[],
    readings,
    picksCount: picksCount ?? 0,
    factsCount: Array.isArray(factsArr) ? factsArr.length : 0,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-misreadings-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;
type Props = { params: Promise<{ slug: string }> };

const yStr = (y: number | null) => (y ? ` (${y})` : "");
const trim = (s: string, n = 158) => (s.length <= n ? s : s.slice(0, n - 3).replace(/\s+\S*$/, "") + "…");

/** Group by framework family (interpretation → form → mind → …), each sorted
 *  strongest-first, films within a family kept together. */
function familyGroups(readings: Reading[]) {
  return FAMILIES
    .map((fam) => ({ fam, items: readings.filter((r) => fw(r.framework).family === fam.key).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)) }))
    .filter((g) => g.items.length > 0);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.director);
  const n = data.readings.length;
  const filmN = new Set(data.readings.map((r) => r.film_slug)).size;
  const title = `Every Strong Misreading of ${data.director}${native ? ` (${native})` : ""}'s Films — ${n} Readings`;
  const famN = familyGroups(data.readings).length;
  const description = trim(`${n} bold, defensible readings across ${filmN} of ${data.director}'s films — argued scene by scene, filed across ${famN} framework famil${famN === 1 ? "y" : "ies"}. Every one an argument with a thesis, not a summary.`);
  return {
    title, description,
    alternates: { canonical: `/director/${slug}/misreadings` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(n >= 5),
  };
}

export default async function DirectorMisreadingsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, films, readings, picksCount, factsCount } = data;
  const native = await directorNative(director);

  const n = readings.length;
  const groups = familyGroups(readings);
  const filmSlugs = new Set(readings.map((r) => r.film_slug));
  const filmN = filmSlugs.size;
  const filmBySlug = new Map(films.map((f) => [f.slug, f]));

  // Most-read film (the door the whole set turns on).
  const perFilm = new Map<string, { title: string; year: number | null; n: number }>();
  for (const r of readings) {
    const e = perFilm.get(r.film_slug) ?? { title: r.film_title, year: r.film_year, n: 0 };
    e.n += 1; perFilm.set(r.film_slug, e);
  }
  const topFilm = [...perFilm.entries()].sort((a, b) => b[1].n - a[1].n || a[1].title.localeCompare(b[1].title))[0] ?? null;
  const topFamily = groups[0] ?? null;

  // Hero backdrop: the most-read film with art, else any film with art.
  const heroFilm = (topFilm ? filmBySlug.get(topFilm[0]) : null) ?? films.find((f) => filmSlugs.has(f.slug) && f.backdrop_path) ?? films.find((f) => f.backdrop_path) ?? null;
  const heroBd = heroFilm?.backdrop_path ?? null;

  // Mid-article stills: backdrops of read films in year order, hero excluded.
  const stills = films.filter((f) => f.backdrop_path && filmSlugs.has(f.slug) && f.slug !== heroFilm?.slug);
  let stillIdx = 0;

  const anchors = new Map(readings.map((r, i) => [r, `r${i + 1}`]));

  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Directors", item: `${SITE}/director` },
      { "@type": "ListItem", position: 3, name: director, item: `${SITE}/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Strong Misreadings", item: `${SITE}/director/${slug}/misreadings` },
    ],
  };
  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    "@id": `${SITE}/director/${slug}/misreadings`,
    headline: `Every Strong Misreading of ${director}'s Films`,
    description: `${n} critical readings across ${filmN} of ${director}'s films, each an argument with a thesis.`,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `${SITE}/director/${slug}` },
    author: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake", url: SITE },
    editor: { "@type": "Person", "@id": `${SITE}/editor#person`, name: "Wonwoo Yoon", url: `${SITE}/editor` },
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake" },
  };

  const hasDoors = picksCount > 0 || factsCount > 0;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the whole set, counted ── */}
      <EntityTVHero playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />

      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>Strong Misreadings</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip"><Link href="/strong-misreadings" style={{ color: "inherit", textDecoration: "none" }}>Strong Misreadings</Link></span>
              <span className="rd-meta">{n} readings · {filmN} films · {groups.length} framework{groups.length === 1 ? "" : "s"}</span>
            </div>
            <h1 className="rd-h1">
              Every Strong Misreading of {director}&apos;s Films
              {native ? <span style={{ fontSize: "0.5em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              {n} bold, defensible readings across {filmN} of {director}&apos;s films
              {topFilm && topFilm[1].n > 1 ? <> — {topFilm[1].title}{yStr(topFilm[1].year)} draws the most, {topFilm[1].n}</> : null}.
              {" "}Each is an argument with a thesis, filed by framework — not a summary.
            </p>
          </div>
          {heroBd && heroFilm ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroBd}`} alt="" width={780} height={439} />
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
              A <Link href="/about#strong-misreadings">Strong Misreading</Link> is the boldest defensible thing a film
              lets you say through one of its figures — the characters, objects, places and forms Metatake singles out.
              Below are all {n} readings of {director}&apos;s {filmN} film{filmN === 1 ? "" : "s"} in the live corpus,
              filed across {groups.length === 1 ? "one framework family" : `${groups.length} framework families`}
              {topFamily ? <>, from {topFamily.fam.label.toLowerCase()} down</> : null}. Drafted by Metatake Editorial,
              edited by <Link href="/editor">Wonwoo Yoon</Link>.
            </p>

            <div className="lin-stats">
              <span className="lin-stat" style={{ "--sc": "#D64534" } as React.CSSProperties}>{n} readings</span>
              <span className="lin-stat" style={{ "--sc": "#2E7D9E" } as React.CSSProperties}>{filmN} film{filmN === 1 ? "" : "s"}</span>
              <span className="lin-stat" style={{ "--sc": "#6B4E9E" } as React.CSSProperties}>{groups.length} framework{groups.length === 1 ? "" : "s"}</span>
              {topFilm && topFilm[1].n > 1 ? <span className="lin-stat" style={{ "--sc": "#B8863B" } as React.CSSProperties}>{topFilm[1].title}: {topFilm[1].n}</span> : null}
            </div>

            {groups.map((g, gi) => (
              <section key={g.fam.key}>
                {gi > 0 && stillIdx < stills.length ? (
                  <figure className={`rd-fig${gi % 2 === 0 ? " rd-fig--inset" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${IMG}/w780${stills[stillIdx++].backdrop_path}`} alt="" loading="lazy" width={780} height={439} />
                    <figcaption>{heroFilm ? director : director}&apos;s cinema · via TMDB</figcaption>
                  </figure>
                ) : null}
                <h2>{g.fam.label}</h2>
                {g.items.map((m) => {
                  const F = fw(m.framework);
                  const thesis = m.rationale ? (m.rationale.length > 320 ? m.rationale.slice(0, 320).trimEnd() + "…" : m.rationale) : null;
                  return (
                    <section key={anchors.get(m)} id={anchors.get(m)}>
                      <h3>{m.take_title ?? `${F.label} — via ${m.figure_label ?? "the film"}`}</h3>
                      <p style={{ fontSize: "0.85em", opacity: 0.75, marginTop: "-0.4em" }}>
                        <span style={{ color: F.color, fontWeight: 600 }}>
                          {F.slug ? <Link href={`/strong-misreadings/${F.slug}`} style={{ color: "inherit" }}>{F.label}</Link> : F.label}
                        </span>
                        {" · "}
                        <Link href={`/film/${m.film_slug}`}>{m.film_title}{yStr(m.film_year)}</Link>
                        {m.figure_label ? (
                          <> · via {m.figure_slug ? <Link href={`/film/${m.film_slug}/figure/${m.figure_slug}`}>{m.figure_label}</Link> : m.figure_label}</>
                        ) : null}
                      </p>
                      {thesis ? <p>{thesis}</p> : null}
                    </section>
                  );
                })}
              </section>
            ))}

            <hr />
            <p>
              These readings are deliberate over-readings — arguments a film can survive, not claims about intent.
              Each anchors to a figure you can follow across cinema. Browse{" "}
              <Link href="/strong-misreadings">all 14 frameworks</Link>, every film&apos;s misreadings on{" "}
              <Link href="/curious/misreadings">Curious</Link>, or open {director} on{" "}
              <Link href={`/director/${slug}`}>Metatake</Link>.
            </p>

            {hasDoors ? (
              <div className="rec-tocs">
                {factsCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/life`}
                    kicker="The life"
                    title={`Who is ${director}? — every researched moment, sourced`}
                    rows={[{ label: "Researched moments", value: factsCount }, { label: "Films", value: films.length }]}
                    cta="Read the life"
                  />
                ) : null}
                {picksCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/start`}
                    kicker="The route in"
                    title={`Where to start with ${director} — the route, argued`}
                    rows={[{ label: "Route stops", value: picksCount }, { label: "Readings", value: n }]}
                    cta="Open the route"
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
            Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> ·{" "}
            <Link href="/methodology">How we work →</Link>
          </p>
          <p style={{ marginTop: 18 }}>
            <Link href={`/director/${slug}`}>← {director} on Metatake: films, the map &amp; the full filmography</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="misreadings" />
    </div>
  );
}
