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
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import { honorText, type FilmLineageRow } from "@/lib/lineage";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/honors — "Every Award {Director}'s Films Have Won"
 * (2026-07-09, wave 2): the filmography's complete honors record as one
 * indexable article. LLM-0: every sentence is counts, titles, years and the
 * lineage archive's own labels. Two sources per film — Metatake's lineage
 * record (rpc film_lineage_for, linked per entry to /lineage hubs) and
 * Wikidata's award statements (film_wd_honors), with the reception page's
 * dedupe grammar: a Wikidata honor whose words overlap a lineage row ≥60%
 * within ±1 year is the same honor and is dropped. Auteur-line rows are
 * excluded — on a director's own page they are self-referential, not honors.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Film = { id: string; slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null; tmdb_id: number | null };
type Wd = { film_id: string; kind: string; label: string; event_date: string | null; year_only: boolean };
type HonorLine = { text: string; href: string | null; marker: "win" | "nom" | "canon"; year: number | null };
type FilmSection = {
  slug: string; title: string; year: number | null;
  poster_path: string | null; backdrop_path: string | null;
  lines: HonorLine[]; hasReception: boolean;
};

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${day}, ${y}`;
};
// Same normalization as the film reception page — the two pages must agree on
// what counts as "the same honor".
const normWords = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

async function loadUncached(slug: string) {
  const supabase = db();
  const [{ data: films, error: filmsErr }, { data: dir }] = await Promise.all([
    supabase.from("films")
      .select("id, slug, title, year, director, backdrop_path, poster_path, tmdb_id")
      .eq("director_slug", slug).eq("visible", true).order("year"),
    supabase.from("directors").select("name").eq("slug", slug).maybeSingle(),
  ]);
  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  const filmArr = films as Film[];
  const filmIds = filmArr.map((f) => f.id);
  const director = (dir?.name as string | undefined) || filmArr[0].director || slug.replace(/-/g, " ");

  const [lineageResults, { data: wdRows }, { data: rcpRows }, { count: picksCount }] = await Promise.all([
    Promise.all(filmArr.map((f) => supabase.rpc("film_lineage_for", { p_film_id: f.id }))),
    supabase.from("film_wd_honors")
      .select("film_id, kind, label, event_date, year_only")
      .in("film_id", filmIds).order("event_date"),
    // Gates the per-film outbound link only (reviews page vs film page).
    // One director's filmography sits comfortably under the 1,000-row cap.
    supabase.from("film_reception").select("film_id").in("film_id", filmIds),
    supabase.from("director_picks").select("pos", { count: "exact", head: true }).eq("director_slug", slug),
  ]);

  const wdByFilm = new Map<string, Wd[]>();
  for (const w of (wdRows ?? []) as Wd[]) wdByFilm.set(w.film_id, [...(wdByFilm.get(w.film_id) ?? []), w]);
  const recSet = new Set(((rcpRows ?? []) as { film_id: string }[]).map((r) => r.film_id));

  let wins = 0, noms = 0, canon = 0;
  const yearsAll: number[] = [];
  const sections: FilmSection[] = [];

  filmArr.forEach((f, idx) => {
    const ln = ((lineageResults[idx].data ?? []) as FilmLineageRow[]).filter((l) => l.facet !== "auteur");

    // Lineage first — the curated record, linked to its /lineage hub.
    const lines: HonorLine[] = [];
    const lnWords: { y: number | null; words: Set<string> }[] = [];
    for (const l of ln) {
      const won = /win|won|winner/i.test(l.result ?? "");
      const marker: HonorLine["marker"] = l.result === "listed" ? "canon" : won ? "win" : "nom";
      const rank = l.rank ? ` — #${l.rank}${l.rank_max ? ` of ${l.rank_max}` : ""}` : "";
      lines.push({
        text: `${l.result ? cap(l.result) : "Honored"} — ${honorText(l)}${rank}.`,
        href: `/lineage/${l.list_slug}`,
        marker,
        year: l.edition_year,
      });
      lnWords.push({ y: l.edition_year ?? null, words: normWords(`${l.parent_label ?? ""} ${l.list_label} ${l.result ?? ""}`) });
    }

    // Then Wikidata statements the lineage doesn't already state — the
    // reception page's dedupe rule: ≥60% word overlap within ±1 year (an
    // undated lineage row matches any year — conservative, never double-counts).
    const dated: HonorLine[] = [];
    const undated: HonorLine[] = [];
    for (const w of wdByFilm.get(f.id) ?? []) {
      const words = normWords(w.label);
      const bar = Math.max(2, Math.floor(words.size * 0.6));
      const overlaps = (t: { words: Set<string> }) => [...words].filter((x) => t.words.has(x)).length >= bar;
      const y = w.event_date ? Number(w.event_date.slice(0, 4)) : null;
      const marker: HonorLine["marker"] = w.kind === "award" ? "win" : "nom";
      if (y && y > 1880) {
        if (lnWords.some((t) => (t.y === null || Math.abs(t.y - y) <= 1) && overlaps(t))) continue;
        dated.push({
          text: w.kind === "award"
            ? `Won the ${w.label}${!w.year_only && w.event_date ? ` on ${fmtDate(w.event_date)}` : ""}.`
            : `Nominated for the ${w.label}${!w.year_only && w.event_date ? ` (announced ${fmtDate(w.event_date)})` : ""}.`,
          href: null, marker, year: y,
        });
      } else {
        if (lnWords.some(overlaps)) continue;
        undated.push({
          text: w.kind === "award" ? `Won the ${w.label}.` : `Nominated for the ${w.label}.`,
          href: null, marker, year: null,
        });
      }
    }

    const all = [...lines, ...dated, ...undated];
    if (!all.length) return;
    for (const l of all) {
      if (l.marker === "win") wins++;
      else if (l.marker === "nom") noms++;
      else canon++;
      if (l.year && l.year > 1880) yearsAll.push(l.year);
    }
    sections.push({
      slug: f.slug, title: f.title, year: f.year,
      poster_path: f.poster_path, backdrop_path: f.backdrop_path,
      lines: all, hasReception: recSet.has(f.id),
    });
  });

  const total = wins + noms + canon;
  if (total === 0) return null;

  // Most honored first — the article's reading order (and the ItemList order).
  sections.sort((a, b) => b.lines.length - a.lines.length || (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));

  const y0 = yearsAll.length ? Math.min(...yearsAll) : null;
  const y1 = yearsAll.length ? Math.max(...yearsAll) : null;
  const native = await directorNative(director);

  return {
    director, native,
    films: filmArr.map((f) => ({ slug: f.slug, title: f.title, year: f.year, backdrop_path: f.backdrop_path, poster_path: f.poster_path })),
    sections,
    wins, noms, canon, total,
    filmsWithHonors: sections.length,
    y0, y1,
    picksCount: picksCount ?? 0,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-honors-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

// Native script stays out of the <title> — a possessive around "(봉준호)"
// misreads; it lives in the h1 and the JSON-LD alternateName instead.
function honorsTitle(d: Data): string {
  const bits: string[] = [];
  if (d.wins > 0) bits.push(`${d.wins} Win${d.wins === 1 ? "" : "s"}`);
  if (d.noms > 0) bits.push(`${d.noms} Nomination${d.noms === 1 ? "" : "s"}`);
  if (d.wins === 0 && d.canon > 0) bits.push(`${d.canon} Canon Listing${d.canon === 1 ? "" : "s"}`);
  const span = d.y0 && d.y1 && d.y1 > d.y0 ? `, ${d.y0}–${d.y1}` : "";
  return d.wins > 0
    ? `Every Award ${d.director}'s Films Have Won — ${bits.join(", ")}${span}`
    : `The Honors Record of ${d.director}'s Films — ${bits.join(", ")}${span}`;
}

function honorsDescription(d: Data): string {
  const top = d.sections[0];
  const parts = [
    d.wins > 0 ? `${d.wins} win${d.wins === 1 ? "" : "s"}` : null,
    d.noms > 0 ? `${d.noms} nomination${d.noms === 1 ? "" : "s"}` : null,
    d.canon > 0 ? `${d.canon} canon listing${d.canon === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
  let description = `The honors record of ${d.director}'s ${d.films.length} film${d.films.length === 1 ? "" : "s"} — ${parts}, film by film, led by ${top.title}${top.year ? ` (${top.year})` : ""}. Sourced per entry.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return description;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = honorsTitle(data);
  const description = honorsDescription(data);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/honors` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.total >= 3),
  };
}

const DECADE_COLORS = ["#D64534", "#C87A2C", "#B8863B", "#6B4E9E", "#2F6DB0", "#12897A", "#B85C9E", "#4E7088"];
const yearColor = (y: number | null) => (y ? DECADE_COLORS[Math.floor(y / 10) % DECADE_COLORS.length] : "#5A6B86");

const CURTAIN_AT = 8; // a film with more honors than this puts the tail behind a curtain

export default async function DirectorHonorsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, native, films, sections, wins, noms, canon, filmsWithHonors, y0, y1, picksCount } = data;

  const title = honorsTitle(data);
  const description = honorsDescription(data);
  const top = sections[0];
  const span = y0 && y1 && y1 > y0 ? `${y0}–${y1}` : null;

  // Hero backdrop: the most-honored film that has art, else any film with art.
  const bdSection = sections.find((s) => s.backdrop_path);
  const bdFilm = bdSection
    ? { title: bdSection.title, year: bdSection.year, backdrop_path: bdSection.backdrop_path! }
    : (() => { const f = films.find((x) => x.backdrop_path); return f ? { title: f.title, year: f.year, backdrop_path: f.backdrop_path! } : null; })();

  // Mid-article stills — the filmography's backdrops, year-sorted (films come
  // ordered by year), hero excluded; deterministic, no shuffle. One still every
  // 3 film sections: section i = 3, 6, 9, 12 → still i/3 − 1.
  const stills = films
    .filter((f) => f.backdrop_path && f.title !== bdFilm?.title)
    .map((f) => ({ title: f.title, year: f.year, backdrop_path: f.backdrop_path as string }))
    .slice(0, 4);

  const metaBits = [
    wins > 0 ? `${wins} win${wins === 1 ? "" : "s"}` : null,
    noms > 0 ? `${noms} nomination${noms === 1 ? "" : "s"}` : null,
    canon > 0 ? `${canon} canon listing${canon === 1 ? "" : "s"}` : null,
    `${filmsWithHonors} of ${films.length} film${films.length === 1 ? "" : "s"}`,
    span,
  ].filter(Boolean).join(" · ");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Honors", item: `https://metatake.net/director/${slug}/honors` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${director}'s most honored films`,
    numberOfItems: Math.min(sections.length, 10),
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: sections.slice(0, 10).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Movie",
        name: s.title,
        url: `https://metatake.net/film/${s.slug}`,
        ...(s.year ? { datePublished: String(s.year) } : {}),
      },
    })),
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/director/${slug}/honors`,
    headline: title,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `https://metatake.net/director/${slug}` },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake", url: "https://metatake.net" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the record, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>Honors</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">The record</span>
              <span className="rd-meta">{metaBits}</span>
            </div>
            <h1 className="rd-h1">
              {wins > 0 ? <>Every Award {director}&apos;s Films Have Won</> : <>The Honors Record of {director}&apos;s Films</>}
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              The filmography&apos;s complete honors record — {filmsWithHonors} of {films.length} film{films.length === 1 ? "" : "s"} honored,
              led by {top.title}{top.year ? ` (${top.year})` : ""} with {top.lines.length} honor{top.lines.length === 1 ? "" : "s"}.
              Metatake&apos;s lineage archive plus Wikidata&apos;s award statements, duplicates removed, sourced per entry.
            </p>
          </div>
          {bdFilm ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${bdFilm.backdrop_path}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {bdFilm.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            {/* ── The record, spelled out ── */}
            <div className="lin-stats">
              {wins > 0 ? <span className="lin-stat" style={{ "--sc": "#B8863B" } as CSSProperties}>🏆 {wins} win{wins === 1 ? "" : "s"}</span> : null}
              {noms > 0 ? <span className="lin-stat" style={{ "--sc": "#C87A2C" } as CSSProperties}>◇ {noms} nomination{noms === 1 ? "" : "s"}</span> : null}
              {canon > 0 ? <span className="lin-stat" style={{ "--sc": "#12897A" } as CSSProperties}>📚 {canon} canon listing{canon === 1 ? "" : "s"}</span> : null}
              <span className="lin-stat" style={{ "--sc": "#5A6B86" } as CSSProperties}>{filmsWithHonors} of {films.length} film{films.length === 1 ? "" : "s"}</span>
              {span ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as CSSProperties}>{span}</span> : null}
            </div>

            <p>
              Across {films.length} film{films.length === 1 ? "" : "s"} on Metatake, {director}&apos;s work holds{" "}
              {[
                wins > 0 ? `${wins} award win${wins === 1 ? "" : "s"}` : null,
                noms > 0 ? `${noms} nomination${noms === 1 ? "" : "s"}` : null,
                canon > 0 ? `${canon} canon listing${canon === 1 ? "" : "s"}` : null,
              ].filter(Boolean).join(", ")}
              {span ? `, spanning ${span}` : ""}. The record below runs film by film, most honored first —
              lineage entries link to their award and canon pages; Wikidata statements the lineage
              already covers are removed.
            </p>

            {sections.map((s, i) => {
              const visible = s.lines.length > CURTAIN_AT ? s.lines.slice(0, CURTAIN_AT) : s.lines;
              const rest = s.lines.length > CURTAIN_AT ? s.lines.slice(CURTAIN_AT) : [];
              const preview = rest.slice(0, 2).map((l) => (l.text.length > 36 ? l.text.slice(0, 36).trimEnd() + "…" : l.text)).join(" · ");
              const still = i > 0 && i % 3 === 0 && i / 3 - 1 < stills.length ? stills[i / 3 - 1] : null;
              const Line = ({ l }: { l: HonorLine }) => (
                <p className="afl-ev afl-ev--honor" data-af="honor">
                  <span aria-hidden>{l.marker === "win" ? "🏆" : l.marker === "canon" ? "📚" : "◇"}</span>{" "}
                  {l.href ? <Link href={l.href}>{l.text}</Link> : l.text}
                </p>
              );
              return (
                <section key={s.slug} id={`f-${s.slug}`} className="afl-year" style={{ "--yc": yearColor(s.year) } as CSSProperties}>
                  {still ? (
                    <figure className="rd-fig" style={{ marginTop: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/w780${still.backdrop_path}`} alt={`${still.title} still`} loading="lazy" width={780} height={439} />
                      <figcaption>{still.title}{still.year ? ` (${still.year})` : ""} · via TMDB</figcaption>
                    </figure>
                  ) : null}
                  <h2 className="afl-h2">
                    <span className="afl-dot" aria-hidden />
                    {s.title}{s.year ? ` (${s.year})` : ""}
                    <span className="afl-yn">{s.lines.length} honor{s.lines.length === 1 ? "" : "s"}</span>
                  </h2>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    {s.poster_path ? (
                      <Link href={`/film/${s.slug}`} style={{ flex: "0 0 auto" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w185${s.poster_path}`} alt={`${s.title} poster`} width={92} height={138} loading="lazy" style={{ width: 92, height: 138, objectFit: "cover", borderRadius: 8, display: "block", background: "#e8e4da" }} />
                      </Link>
                    ) : null}
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      {visible.map((l, j) => <Line key={j} l={l} />)}
                      {rest.length > 0 ? (
                        <details className="vl-d">
                          <summary>
                            <span className="vl-sum-d">More honors</span>
                            <span className="vl-n">{rest.length}</span>
                            <span className="vl-sum-kw">{preview}{rest.length > 2 ? " …" : ""}</span>
                          </summary>
                          <div style={{ padding: "2px 18px 14px 20px" }}>
                            {rest.map((l, j) => <Line key={j} l={l} />)}
                          </div>
                        </details>
                      ) : null}
                      <p style={{ fontSize: "0.92em" }}>
                        {s.hasReception ? (
                          <Link href={`/film/${s.slug}/reception`}>Reviews &amp; afterlife of {s.title} →</Link>
                        ) : (
                          <Link href={`/film/${s.slug}`}>Open {s.title} on Metatake →</Link>
                        )}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* ── Sideways doors ── */}
            {films.length >= 3 || picksCount > 0 ? (
              <div className="rec-tocs">
                {films.length >= 3 ? (
                  <RecordToc
                    href={`/director/${slug}/takescore`}
                    kicker="The scoreboard"
                    title={`Every ${director} film, scored — the TakeScore ranking`}
                    rows={[
                      { label: "Films", value: films.length },
                      ...(wins > 0 ? [{ label: "Wins", value: wins }] : []),
                    ]}
                    cta="Open the ranking"
                  />
                ) : null}
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
              </div>
            ) : null}

            <hr />
            <p>
              Sources: Metatake&apos;s <Link href="/lineage">lineage archive</Link> (each entry links to its award or
              canon page) and award statements via{" "}
              <a href="https://www.wikidata.org" target="_blank" rel="noopener nofollow">Wikidata</a>; posters and
              stills via <a href="https://www.themoviedb.org" target="_blank" rel="noopener nofollow">TMDB</a>.
              Wins, nominations and listings are counted from the rows shown — nothing is estimated.
            </p>
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

      <DirectorPlates slug={slug} exclude="honors" />
    </div>
  );
}
