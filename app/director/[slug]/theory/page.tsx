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
import DirectorPlates from "@/components/read/DirectorPlates";
import ShareDock from "@/components/ShareDock";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import { FAMILIES, fw } from "@/lib/frameworks";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/theory — "{Director} Through Theory" (2026-07-09, wave 2):
 * which lenses the filmography answers to. LLM-0: every sentence is assembled
 * from the readings corpus — counts, years, titles, names only. Readings are
 * REPORTED ("was read as"), never asserted; the reading's content never gets
 * an assertive ending of its own. Concept labels are free text — rendered as
 * unlinked chips (404-link ban); theorist chips link only when the slug
 * resolved from the theorists table.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Film = { id: string; slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null };

type TakeRow = {
  id: string; framework: string | null; concept: string | null;
  theorist_name: string | null; theorist_id: number | string | null;
  take_title: string | null; rationale: string | null; strength: number | null;
  figure_id: string;
  figure: { film_id: string; label: string | null; slug: string | null };
};

type Reading = {
  id: string; framework: string | null; concept: string | null;
  theoristName: string | null; theoristKey: string | null;
  title: string | null; rationale: string | null; strength: number | null;
  figLabel: string; figSlug: string | null;
  filmSlug: string; filmTitle: string; filmYear: number | null;
};

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: films, error: filmsErr } = await supabase
    .from("films")
    .select("id, slug, title, year, director, backdrop_path, poster_path")
    .eq("director_slug", slug).eq("visible", true).order("year");
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  const filmArr = films as Film[];
  const filmIds = filmArr.map((f) => f.id);
  const director = filmArr[0].director || slug.replace(/-/g, " ");

  // Every published non-invitation reading across the filmography, with its
  // figure and framework/theorist/concept fields. PostgREST caps responses at
  // 1000 rows — paginate on a stable order until the batch comes up short.
  const PAGE = 1000;
  const rows: TakeRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("takes")
      .select("id, framework, concept, theorist_name, theorist_id, take_title, rationale, strength, figure_id, figure:figures!inner(film_id, label, slug)")
      .in("figure.film_id", filmIds)
      .eq("status", "published")
      .eq("is_invitation", false)
      .order("id")
      .range(from, from + PAGE - 1);
    const batch = ((data ?? []) as unknown) as TakeRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  if (rows.length === 0) return null;

  // Resolve theorist slugs — the takes carry the name directly; the slug (for
  // /theorist/[slug] links) lives in the theorists table. Unresolved names
  // render unlinked.
  const thIds = [...new Set(rows.map((r) => r.theorist_id).filter((x): x is number | string => x !== null && x !== undefined))];
  const theoristBy: Record<string, { slug: string; name: string }> = {};
  for (let i = 0; i < thIds.length; i += 150) {
    const { data: th } = await supabase.from("theorists").select("id, slug, name").in("id", thIds.slice(i, i + 150));
    for (const t of (th ?? []) as { id: number | string; slug: string; name: string }[]) {
      theoristBy[String(t.id)] = { slug: t.slug, name: t.name };
    }
  }

  const filmById = new Map(filmArr.map((f) => [f.id, f]));
  const readings: Reading[] = [];
  for (const t of rows) {
    const film = filmById.get(t.figure?.film_id);
    if (!film) continue;
    readings.push({
      id: t.id, framework: t.framework, concept: t.concept,
      theoristName: t.theorist_name, theoristKey: t.theorist_id != null ? String(t.theorist_id) : null,
      title: t.take_title, rationale: t.rationale, strength: t.strength,
      figLabel: t.figure.label ?? "", figSlug: t.figure.slug ?? null,
      filmSlug: film.slug, filmTitle: film.title, filmYear: film.year,
    });
  }
  if (readings.length === 0) return null;

  // Sideways-door head counts (gates: start = ≥1 pick, life = facts.length > 0).
  const [{ count: picksCount }, { data: factsRow }] = await Promise.all([
    supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
    supabase.from("director_facts").select("facts").eq("director_slug", slug).maybeSingle(),
  ]);
  const factsArr = (factsRow?.facts ?? null) as { n: number }[] | null;
  const factsCount = Array.isArray(factsArr) ? factsArr.length : 0;

  const native = await directorNative(director);

  return {
    director, native,
    films: filmArr,
    readings,
    theoristBy,
    picksCount: picksCount ?? 0,
    factsCount,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-theory-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

/* ── The verbalizer: deterministic aggregates over the readings corpus ── */

function lensFacts(d: Data) {
  const { readings, films, theoristBy } = d;
  const n = readings.length;
  const filmBySlug = new Map(films.map((f) => [f.slug, f]));

  // Per-film reading counts (hero backdrop = most-read film; stills follow).
  const perFilm = new Map<string, number>();
  for (const r of readings) perFilm.set(r.filmSlug, (perFilm.get(r.filmSlug) ?? 0) + 1);
  const filmsRead = perFilm.size;

  // Framework families, in the site's canonical order.
  const byFamily = FAMILIES.map((fam) => {
    const items = readings.filter((r) => fw(r.framework).family === fam.key);
    if (items.length === 0) return null;
    const fcount = new Map<string, number>();
    for (const r of items) fcount.set(r.filmSlug, (fcount.get(r.filmSlug) ?? 0) + 1);
    const [topSlug, topN] = [...fcount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const kcount = new Map<string, number>();
    for (const r of items) { const k = r.framework ?? ""; kcount.set(k, (kcount.get(k) ?? 0) + 1); }
    const fws = [...kcount.entries()]
      .map(([key, c]) => ({ f: fw(key), n: c }))
      .sort((a, b) => b.n - a.n || a.f.label.localeCompare(b.f.label));
    return { fam, k: items.length, topFilm: filmBySlug.get(topSlug) ?? null, topN, fws };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  // Distinct framework labels (hero meta) + overall top labels (title fallback).
  const fwCount = new Map<string, number>();
  for (const r of readings) { const l = fw(r.framework).label; fwCount.set(l, (fwCount.get(l) ?? 0) + 1); }
  const fwTop = [...fwCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Theorists behind the readings, counted; slug + thumbnail resolved.
  const thMap = new Map<string, { name: string; slug: string | null; n: number; bd: string | null; film: string | null }>();
  for (const r of readings) {
    const name = (r.theoristName ?? "").trim();
    if (!name) continue;
    const cur = thMap.get(name) ?? { name, slug: null, n: 0, bd: null, film: null };
    cur.n += 1;
    if (!cur.slug && r.theoristKey && theoristBy[r.theoristKey]) cur.slug = theoristBy[r.theoristKey].slug;
    if (!cur.bd) {
      const bd = filmBySlug.get(r.filmSlug)?.backdrop_path ?? null;
      if (bd) { cur.bd = bd; cur.film = r.filmTitle; }
    }
    thMap.set(name, cur);
  }
  const theorists = [...thMap.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const withTheorist = readings.filter((r) => (r.theoristName ?? "").trim()).length;

  // Concepts in play — free labels, counted only (never linked: no slug to verify).
  const cMap = new Map<string, number>();
  for (const r of readings) {
    const c = (r.concept ?? "").replace(/\s+/g, " ").trim();
    if (!c) continue;
    cMap.set(c, (cMap.get(c) ?? 0) + 1);
  }
  const concepts = [...cMap.entries()].map(([label, cnt]) => ({ label, n: cnt }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const withConcept = readings.filter((r) => (r.concept ?? "").trim()).length;

  // Representative readings: top 6 by strength, at most one per film.
  const reps: Reading[] = [];
  const seenFilm = new Set<string>();
  const ordered = [...readings].sort((a, b) =>
    (b.strength ?? 0) - (a.strength ?? 0) || (a.title ?? "").localeCompare(b.title ?? "") || a.id.localeCompare(b.id));
  for (const r of ordered) {
    if (seenFilm.has(r.filmSlug)) continue;
    seenFilm.add(r.filmSlug);
    reps.push(r);
    if (reps.length >= 6) break;
  }

  // Art: films with backdrops, most-read first — [0] is the hero, the next two
  // are the mid-article stills. Deterministic (no Math.random).
  const artFilms = films.filter((f) => f.backdrop_path)
    .sort((a, b) => (perFilm.get(b.slug) ?? 0) - (perFilm.get(a.slug) ?? 0) || (a.year ?? 9999) - (b.year ?? 9999) || a.slug.localeCompare(b.slug));

  return { n, filmsRead, byFamily, fwTop, theorists, withTheorist, concepts, withConcept, reps, artFilms, perFilm };
}

type Lens = ReturnType<typeof lensFacts>;

function viaPhrase(F: Lens): string {
  const names = F.theorists.length
    ? F.theorists.slice(0, 2).map((t) => t.name)
    : F.fwTop.slice(0, 2).map(([label]) => label);
  if (names.length >= 2) return `${names[0]}, ${names[1]} & More`;
  if (names.length === 1) return `${names[0]} & More`;
  return "14 Frameworks";
}

function theoryTitle(d: Data, F: Lens): string {
  return `${d.director} Through Theory — ${F.n} Reading${F.n === 1 ? "" : "s"} via ${viaPhrase(F)}`;
}

function theoryDescription(d: Data, F: Lens): string {
  const famTop = [...F.byFamily].sort((a, b) => b.k - a.k || a.fam.label.localeCompare(b.fam.label))[0];
  let description = `Which lenses does ${d.director}'s filmography answer to? ${F.n} readings across ${F.filmsRead} film${F.filmsRead === 1 ? "" : "s"}${famTop ? ` — ${famTop.fam.label.toLowerCase()} leads with ${famTop.k}` : ""}${F.theorists[0] ? `, most often through ${F.theorists[0].name}` : ""}.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return description;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const F = lensFacts(data);
  const title = theoryTitle(data, F);
  const description = theoryDescription(data, F);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/theory` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(F.n >= 5),
  };
}

const yStr = (y: number | null) => (y ? ` (${y})` : "");

export default async function DirectorTheoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, native, films, picksCount, factsCount } = data;
  const F = lensFacts(data);
  const { n } = F;

  const heroFilm = F.artFilms[0] ?? null;
  const stills = F.artFilms.slice(1, 3);
  const fwN = F.fwTop.length;
  const thN = F.theorists.length;
  const cN = F.concepts.length;
  const famN = F.byFamily.length;

  const title = theoryTitle(data, F);
  const description = theoryDescription(data, F);
  const canonical = `${SITE}/director/${slug}/theory`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Directors", item: `${SITE}/director` },
      { "@type": "ListItem", position: 3, name: director, item: `${SITE}/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Through Theory", item: canonical },
    ],
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonical,
    headline: title,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `${SITE}/director/${slug}` },
    author: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake", url: SITE },
    editor: { "@type": "Person", "@id": `${SITE}/editor#person`, name: "Wonwoo Yoon", url: `${SITE}/editor` },
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake" },
  };

  const hasDoors = picksCount > 0 || factsCount > 0;
  const conceptsShown = F.concepts.slice(0, 18);
  const theoristsShown = F.theorists.slice(0, 24);

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the lenses, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>Through Theory</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">Through theory</span>
              <span className="rd-meta">{n} readings · {fwN} framework{fwN === 1 ? "" : "s"} · {thN} theorist{thN === 1 ? "" : "s"}</span>
            </div>
            <h1 className="rd-h1">
              {director} Through Theory
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              {n} Strong Misreading{n === 1 ? "" : "s"} across {F.filmsRead} of {director}&apos;s {films.length} film{films.length === 1 ? "" : "s"},
              filed under {famN} framework famil{famN === 1 ? "y" : "ies"}
              {thN > 0 ? <> with {thN} theorist{thN === 1 ? "" : "s"} behind them</> : null}.
              Counted below: which lenses the filmography answers to, and where each one lands.
            </p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/director/${slug}/theory`} title={title} hook={description} />
              <ShareDock variant="fab" path={`/director/${slug}/theory`} title={title} hook={description} />
            </div>
          </div>
          {heroFilm?.backdrop_path ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroFilm.backdrop_path}`} alt="" width={780} height={439} />
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
              Every Strong Misreading on Metatake is filed under a named lens. Across {director}&apos;s{" "}
              {films.length} film{films.length === 1 ? "" : "s"}, {n} published reading{n === 1 ? "" : "s"} carr{n === 1 ? "ies" : "y"} such
              a filing — {F.withTheorist} of them name a theorist outright, and {F.withConcept} name a concept.
              Readings are reported here as they were filed — &ldquo;was read as&rdquo;, not &ldquo;is&rdquo; —
              arguments the films can survive, not verdicts about intent. Readings written by Metatake AI, assembled
              here by the Metatake method, designed by <Link href="/editor">Wonwoo Yoon</Link>, who
              answers for it.
            </p>

            {/* 1 — the counts, as chips */}
            <div className="lin-stats">
              <span className="lin-stat" style={{ "--sc": "#D64534" } as CSSProperties}>{n} reading{n === 1 ? "" : "s"}</span>
              <span className="lin-stat" style={{ "--sc": "#B8863B" } as CSSProperties}>{famN} framework famil{famN === 1 ? "y" : "ies"}</span>
              <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as CSSProperties}>{thN} theorist{thN === 1 ? "" : "s"}</span>
              <span className="lin-stat" style={{ "--sc": "#7E57C2" } as CSSProperties}>{cN} concept{cN === 1 ? "" : "s"}</span>
              <span className="lin-stat" style={{ "--sc": "#12897A" } as CSSProperties}>{F.filmsRead} of {films.length} films read</span>
            </div>

            {/* 2 — the lenses, counted: family distribution as sentences + fw chips */}
            <h2>The lenses, counted</h2>
            <p>
              The {n} reading{n === 1 ? "" : "s"} fall{n === 1 ? "s" : ""} into {famN} of the site&apos;s five framework
              families. Per family: how many readings it stages, and the film where most of them land.
            </p>
            {F.byFamily.map((g) => (
              <div key={g.fam.key} style={{ margin: "14px 0 18px" }}>
                <p style={{ margin: "0 0 6px" }}>
                  <b>{g.fam.label}</b>{" "}
                  {g.k === 1 ? (
                    <>stages a single reading, filed in {g.topFilm ? <Link href={`/film/${g.topFilm.slug}`}>{g.topFilm.title}</Link> : null}{g.topFilm ? yStr(g.topFilm.year) : ""}.</>
                  ) : g.topN > 1 ? (
                    <>stages {g.k} of the {n} readings — most often in {g.topFilm ? <Link href={`/film/${g.topFilm.slug}`}>{g.topFilm.title}</Link> : null}{g.topFilm ? yStr(g.topFilm.year) : ""}, where {g.topN} of them land.</>
                  ) : (
                    <>stages {g.k} of the {n} readings, one per film — {g.topFilm ? <Link href={`/film/${g.topFilm.slug}`}>{g.topFilm.title}</Link> : null}{g.topFilm ? yStr(g.topFilm.year) : ""} among them.</>
                  )}
                </p>
                <div className="lin-stats">
                  {g.fws.map(({ f, n: c }) => f.slug ? (
                    <Link
                      key={f.slug}
                      className="lin-stat"
                      style={{ "--sc": f.color, textDecoration: "none" } as CSSProperties}
                      href={`/strong-misreadings/${f.slug}`}
                    >
                      {f.label} ×{c}
                    </Link>
                  ) : (
                    <span key={`x-${f.label}`} className="lin-stat" style={{ "--sc": f.color } as CSSProperties}>{f.label} ×{c}</span>
                  ))}
                </div>
              </div>
            ))}

            {stills[0]?.backdrop_path ? (
              <figure className="rd-fig">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/w780${stills[0].backdrop_path}`} alt={`${stills[0].title} still`} loading="lazy" width={780} height={439} />
                <figcaption>{stills[0].title}{yStr(stills[0].year)} · via TMDB</figcaption>
              </figure>
            ) : null}

            {/* 3 — the theorists behind the readings */}
            {theoristsShown.length > 0 ? (
              <>
                <h2>The theorists behind the readings</h2>
                <p>
                  {thN} theorist{thN === 1 ? " is" : "s are"} named across the {n} reading{n === 1 ? "" : "s"} —
                  each count is the number of readings that borrow that lens on {director}&apos;s films.
                  Named chips open the theorist&apos;s own page.
                </p>
                <div className="fig-cloud">
                  {theoristsShown.map((t) =>
                    t.slug ? (
                      <Link key={t.name} href={`/theorist/${t.slug}`} className={`fig-chip${t.bd ? "" : " fig-chip--bare"}`}>
                        {t.bd ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${IMG}/w300${t.bd}`} alt={`${t.film ?? director} still`} width={56} height={32} loading="lazy" />
                        ) : null}
                        <span>{t.name}{t.n > 1 ? <span className="fig-chip__n"> ×{t.n}</span> : null}</span>
                      </Link>
                    ) : (
                      <span key={t.name} className={`fig-chip${t.bd ? "" : " fig-chip--bare"}`}>
                        {t.bd ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${IMG}/w300${t.bd}`} alt={`${t.film ?? director} still`} width={56} height={32} loading="lazy" />
                        ) : null}
                        <span>{t.name}{t.n > 1 ? <span className="fig-chip__n"> ×{t.n}</span> : null}</span>
                      </span>
                    )
                  )}
                </div>
                {F.theorists.length > theoristsShown.length ? (
                  <p style={{ fontSize: "0.92em" }}>+ {F.theorists.length - theoristsShown.length} more theorists named once or twice.</p>
                ) : null}
              </>
            ) : null}

            {/* 4 — the concepts in play (free labels: counted, never linked) */}
            {conceptsShown.length > 0 ? (
              <>
                <h2>The concepts in play</h2>
                <p>
                  {cN} named concept{cN === 1 ? "" : "s"} appear{cN === 1 ? "s" : ""} across the readings of{" "}
                  {director}&apos;s films — counted as filed, most-used first.
                </p>
                <div className="lin-stats">
                  {conceptsShown.map((c) => (
                    <span key={c.label} className="lin-stat" style={{ "--sc": "#5B4DAF" } as CSSProperties}>{c.label} ×{c.n}</span>
                  ))}
                </div>
                {F.concepts.length > conceptsShown.length ? (
                  <p style={{ fontSize: "0.92em" }}>+ {F.concepts.length - conceptsShown.length} more, each named once or twice.</p>
                ) : null}
              </>
            ) : null}

            {stills[1]?.backdrop_path ? (
              <figure className="rd-fig rd-fig--inset">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/w780${stills[1].backdrop_path}`} alt={`${stills[1].title} still`} loading="lazy" width={780} height={439} />
                <figcaption>{stills[1].title}{yStr(stills[1].year)} · via TMDB</figcaption>
              </figure>
            ) : null}

            {/* 5 — representative readings, reported as filed */}
            <h2>Representative readings — as filed</h2>
            <p>
              The {F.reps.length === 1 ? "strongest reading" : `${F.reps.length} strongest readings`}, at most one per
              film. Each is reported as it was filed — an argument the film can survive, not a verdict.
            </p>
            <div className="dr-mr-cards">
              {F.reps.map((m) => {
                const f = fw(m.framework);
                const thesis = m.rationale ? (m.rationale.length > 220 ? m.rationale.slice(0, 220).trimEnd() + "…" : m.rationale) : null;
                const figHref = m.figSlug ? `/film/${m.filmSlug}/figure/${m.figSlug}` : `/film/${m.filmSlug}#df-readings`;
                const tName = (m.theoristName ?? "").trim();
                const tSlug = m.theoristKey ? data.theoristBy[m.theoristKey]?.slug ?? null : null;
                return (
                  <div className="dr-mr-card" key={m.id}>
                    <div className="dr-mr-top">
                      <span className="dr-mr-fw" style={{ color: f.color }}>{f.label}</span>
                      <Link className="dr-mr-film" href={`/film/${m.filmSlug}#df-readings`}>{m.filmTitle}{yStr(m.filmYear)}</Link>
                    </div>
                    {m.title ? <Link className="dr-mr-title" href={figHref}>{m.title}</Link> : null}
                    {thesis ? <p className="dr-mr-thesis">{thesis}</p> : null}
                    <div className="dr-mr-via">
                      <span className="dr-mr-vk">via</span>{" "}
                      {m.figSlug ? <Link href={figHref}>{m.figLabel}</Link> : <span>{m.figLabel}</span>}
                      {tName ? (
                        <> · read through {tSlug ? <Link href={`/theorist/${tSlug}`}>{tName}</Link> : tName}</>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasDoors ? (
              <div className="rec-tocs">
                {picksCount > 0 ? (
                  <RecordToc
                    href={`/director/${slug}/start`}
                    kicker="The route in"
                    title={`Where to start with ${director} — the ${picksCount}-film route, argued`}
                    rows={[
                      { label: "Route stops", value: picksCount },
                      { label: "Films read", value: films.length },
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
                      { label: "Readings", value: n },
                    ]}
                    cta="Open the life"
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
            Written by Metatake AI · to a framework by <Link href="/editor">Wonwoo Yoon</Link> ·{" "}
            <Link href="/methodology">How we work →</Link>
          </p>
          <p style={{ marginTop: 18 }}>
            <Link href={`/director/${slug}`}>← {director} on Metatake: films, readings &amp; the full filmography</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="theory" />
    </div>
  );
}
