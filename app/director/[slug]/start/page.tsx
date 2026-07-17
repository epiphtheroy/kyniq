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
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/start — "Where to Start with {Director}" as its own
 * indexable article (2026-07-09): the director hub's dr-start section promoted
 * to a standalone SEO page. Render is LLM-0 — every sentence here is assembled
 * from DB fields — but that is a claim about render time only: the picks and
 * their `reason` prose were drafted offline by Metatake AI (worker/director-picks-gen.py,
 * Opus batch) and are stored data by the time this page reads them. Credit is
 * label A accordingly (2026-07-17, HANDOFF-AI집필크레딧-표기개편.md D7). The rest
 * is counts, titles, years and labels. The hub keeps its compact picks list;
 * this page is the full route, read in order.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Pick = { pos: number; film_slug: string | null; film_title: string | null; film_year: number | null; label: string | null; reason: string | null };
type Film = { id: string; slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null };

async function loadUncached(slug: string) {
  const supabase = db();
  const [{ data: films, error: filmsErr }, { data: dir }, { data: picks }, { data: factsRow }, { count: nextCount }] = await Promise.all([
    supabase.from("films").select("id, slug, title, year, director, backdrop_path, poster_path").eq("director_slug", slug).eq("visible", true).order("year"),
    supabase.from("directors").select("name").eq("slug", slug).maybeSingle(),
    supabase.from("director_picks").select("pos, film_slug, film_title, film_year, label, reason").eq("director_slug", slug).order("pos"),
    supabase.from("director_facts").select("facts").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_next").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
  ]);
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  if (!picks || picks.length === 0) return null;
  const filmArr = films as Film[];
  const director = (dir?.name as string | undefined) || filmArr[0].director || slug.replace(/-/g, " ");

  // Per-film published reading counts (same pattern as the hub page).
  const filmIds = filmArr.map((f) => f.id);
  const { data: readRows } = await supabase
    .from("takes").select("figure:figures!inner(film_id)").in("figure.film_id", filmIds).eq("status", "published");
  const perFilmReadings: Record<string, number> = {};
  for (const r of (readRows ?? []) as unknown[]) {
    const fid = (r as { figure: { film_id: string } }).figure.film_id;
    perFilmReadings[fid] = (perFilmReadings[fid] ?? 0) + 1;
  }
  let totalReadings = 0;
  for (const k of Object.keys(perFilmReadings)) totalReadings += perFilmReadings[k];

  const factsArr = (factsRow?.facts ?? null) as { n: number }[] | null;
  const factsCount = Array.isArray(factsArr) ? factsArr.length : 0;

  const native = await directorNative(director);

  return {
    director, native,
    films: filmArr,
    picks: picks as Pick[],
    perFilmReadings, totalReadings,
    factsCount,
    nextCount: nextCount ?? 0,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-start-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

// The "Start here" pick anchors the hero and the description; fall back to the
// first pick in the route when no pick carries that exact label.
function startPickOf(picks: Pick[]): Pick {
  return picks.find((p) => (p.label ?? "").trim().toLowerCase() === "start here") ?? picks[0];
}

function routeTitle(d: Data): string {
  return `Where to Start with ${d.director}${d.native ? ` (${d.native})` : ""} — a ${d.picks.length}-Film Route`;
}

function routeDescription(d: Data): string {
  const filmBySlug = new Map(d.films.map((f) => [f.slug, f]));
  const sp = startPickOf(d.picks);
  const spFilm = sp.film_slug ? filmBySlug.get(sp.film_slug) : undefined;
  const startTitle = sp.film_title ?? spFilm?.title ?? "";
  const startYear = sp.film_year ?? spFilm?.year ?? null;
  const rest = d.picks.length - 1;
  let description = `A ${d.picks.length}-film route into ${d.director}'s work — start with ${startTitle}${startYear ? ` (${startYear})` : ""}${rest > 0 ? `, then ${rest} more stop${rest === 1 ? "" : "s"}` : ""} across the ${d.films.length} film${d.films.length === 1 ? "" : "s"} read on Metatake.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return description;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = routeTitle(data);
  const description = routeDescription(data);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/start` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.picks.length >= 3),
  };
}

export default async function DirectorStartPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, native, films, picks, perFilmReadings, totalReadings, factsCount, nextCount } = data;

  const filmBySlug = new Map(films.map((f) => [f.slug, f]));
  const startPick = startPickOf(picks);
  const startFilm = startPick.film_slug ? filmBySlug.get(startPick.film_slug) : undefined;

  // Hero backdrop: the "Start here" pick's film, else any film with art.
  const bdFilm = startFilm?.backdrop_path ? startFilm : films.find((f) => f.backdrop_path);
  const heroBd = bdFilm?.backdrop_path ?? null;

  // The route order, spelled by its labels (pos order).
  const labelChain = picks.map((p) => p.label).filter((l): l is string => !!l).join(" → ");

  const pickSlugs = new Set(picks.map((p) => p.film_slug).filter(Boolean));
  const remaining = films.filter((f) => !pickSlugs.has(f.slug)).slice().sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  // Mid-article stills: after every 2nd route stop, one backdrop rotated in
  // year order (the films query is year-ordered), never repeating a still,
  // never the hero's film, and never the film whose poster the reader just
  // saw at that stop. Deterministic; skipped once the gallery runs out.
  const stillPool = films.filter((f) => f.backdrop_path && f.slug !== bdFilm?.slug);
  const stillAfterStop = new Map<number, Film>();
  {
    const used = new Set<string>();
    picks.forEach((p, i) => {
      if ((i + 1) % 2 !== 0) return;
      const cand = stillPool.find((f) => !used.has(f.slug) && f.slug !== p.film_slug);
      if (!cand) return;
      used.add(cand.slug);
      stillAfterStop.set(i, cand);
    });
  }

  const years = films.map((f) => f.year).filter((y): y is number => typeof y === "number");
  const span = years.length > 1 ? ` (${Math.min(...years)}–${Math.max(...years)})` : "";

  const title = routeTitle(data);
  const description = routeDescription(data);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Where to Start", item: `https://metatake.net/director/${slug}/start` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Where to start with ${director} — a ${picks.length}-film route`,
    numberOfItems: picks.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: picks.map((p, i) => ({
      "@type": "ListItem",
      position: p.pos ?? i + 1,
      item: {
        "@type": "Movie",
        name: p.film_title ?? (p.film_slug ? filmBySlug.get(p.film_slug)?.title ?? "" : ""),
        ...(p.film_slug ? { url: `https://metatake.net/film/${p.film_slug}` } : {}),
        ...(p.film_year ? { datePublished: String(p.film_year) } : {}),
      },
    })),
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/director/${slug}/start`,
    headline: title,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `https://metatake.net/director/${slug}` },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake", url: "https://metatake.net" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };

  const hasDoors = factsCount > 0 || nextCount > 0;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the route, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>Where to Start</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">The route in</span>
              <span className="rd-meta">{picks.length}-film route · {films.length} films read · {totalReadings} readings</span>
            </div>
            <h1 className="rd-h1">
              Where to Start with {director}
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              {labelChain ? <>{picks.length} stops, in order: {labelChain}. </> : <>{picks.length} stops, in order. </>}
              A curated route through {director}&apos;s filmography — each film chosen for what it opens, not by box office.
            </p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/director/${slug}/start`} title={title} hook={description} />
              <ShareDock variant="fab" path={`/director/${slug}/start`} title={title} hook={description} />
            </div>
          </div>
          {heroBd ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroBd}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {bdFilm!.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            <p>
              {director} has {films.length} film{films.length === 1 ? "" : "s"} read closely on Metatake{span}, carrying{" "}
              {totalReadings} published reading{totalReadings === 1 ? "" : "s"}. This is a route through that work —{" "}
              {picks.length} stop{picks.length === 1 ? "" : "s"} in a deliberate order, chosen for where each film takes
              you next rather than ranked by box office. The route and its reasons are written by Metatake AI, to a brief
              designed by <Link href="/editor">Wonwoo Yoon</Link>, who answers for it.
            </p>

            {picks.map((p, i) => {
              const film = p.film_slug ? filmBySlug.get(p.film_slug) : undefined;
              const filmTitle = p.film_title ?? film?.title ?? "";
              const year = p.film_year ?? film?.year ?? null;
              const poster = film?.poster_path ?? null;
              const count = film ? perFilmReadings[film.id] ?? 0 : 0;
              const pos = p.pos ?? i + 1;
              const still = stillAfterStop.get(i);
              return (
                <Fragment key={pos}>
                <section id={`stop-${pos}`}>
                  {p.label ? <div className="afl-k" style={{ "--kc": "#B8863B" } as CSSProperties}>{p.label}</div> : null}
                  <h2 style={p.label ? { marginTop: 0 } : undefined}>{pos}. {filmTitle}{year ? ` (${year})` : ""}</h2>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    {poster && p.film_slug ? (
                      <Link href={`/film/${p.film_slug}`} style={{ flex: "0 0 auto" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w185${poster}`} alt={`${filmTitle} poster`} width={110} height={165} loading="lazy" style={{ width: 110, height: 165, objectFit: "cover", borderRadius: 8, display: "block", background: "#e8e4da" }} />
                      </Link>
                    ) : null}
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      {p.reason ? <p style={{ marginTop: 0 }}>{p.reason}</p> : null}
                      <p style={{ fontSize: "0.92em" }}>
                        {count > 0 && p.film_slug ? (
                          <Link href={`/film/meaning/${p.film_slug}`}>{count} Strong Misreading{count === 1 ? "" : "s"} on Metatake →</Link>
                        ) : p.film_slug ? (
                          <Link href={`/film/${p.film_slug}`}>Open {filmTitle} on Metatake →</Link>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </section>
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

            {remaining.length > 0 ? (
              <>
                <hr />
                <h2>After the route</h2>
                <p>
                  The route covers {picks.length} of {director}&apos;s {films.length} film{films.length === 1 ? "" : "s"} read
                  on Metatake. The rest, by year:{" "}
                  {remaining.map((f, i) => (
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
                {factsCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/life`}
                    kicker="The record"
                    title={`Who is ${director}? — the researched life`}
                    rows={[{ label: "Moments", value: factsCount }]}
                    cta="Read the life"
                  />
                ) : null}
                {nextCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/next`}
                    kicker="The record"
                    title={`After ${director} — who to watch next`}
                    rows={[{ label: "Recommendations", value: nextCount }]}
                    cta="See who's next"
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
            <Link href={`/director/${slug}`}>← {director} on Metatake: films, readings &amp; the full filmography</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="start" />
    </div>
  );
}
