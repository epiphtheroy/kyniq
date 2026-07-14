import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import AccessCountryProvider from "@/components/AccessCountryProvider";
import WatchPageClient, { type WatchFilm, type WatchData, type WatchRatings } from "@/components/WatchPageClient";
import type { AccessRecord } from "@/components/AccessEnrichment";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import accessEnrichment from "@/lib/access_enrichment.json";
import { resolveAlias } from "@/lib/aliases";
import { pageRobots } from "@/lib/seo";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /whereto/[slug] — where-to-watch as an ARTICLE (2026-07-08 redesign), not
 * just a provider matrix. The read layer on top is a rule-based report —
 * every sentence assembled from data already on file (JustWatch/TMDB matrix +
 * MetaTake-verified archives, MUBI-by-country checks, disc editions), no
 * generation. The interactive matrix (WatchPageClient) stays as the play
 * layer below; the dark ReadHero + plates match the other reading pages.
 */
export const revalidate = 300;
export async function generateStaticParams() { return []; }

interface Props { params: Promise<{ slug: string }>; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function accessRecordFor(tmdbId: number | null | undefined): AccessRecord | null {
  if (!tmdbId) return null;
  const films = (accessEnrichment as unknown as { films: Record<string, AccessRecord> }).films;
  return films[String(tmdbId)] ?? null;
}

type FigLink = { slug: string; label: string };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, runtime, poster_path, backdrop_path, imdb_id, tmdb_id, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  const filmId = (film as { id: string }).id;
  const [{ data: wpRow }, { data: ratRow }, { data: codex }, { data: figRows }, { data: vidRows }] = await Promise.all([
    supabase.from("film_watch_providers").select("results, countries, fetched_at").eq("film_id", filmId).maybeSingle(),
    supabase.from("film_ratings").select("imdb_rating, imdb_votes, metascore, rt_tomatometer").eq("film_id", filmId).maybeSingle(),
    supabase.rpc("cinecodex_for", { p_slug: slug }),
    supabase.from("figures").select("slug, label").eq("film_id", filmId).eq("status", "approved").not("slug", "is", null).limit(6),
    supabase.from("media").select("external_id, title").eq("entity_type", "film").eq("entity_id", filmId)
      .eq("status", "published").eq("kind", "video").order("position"),
  ]);
  const cx = codex as { v: number; c: number; r: number } | null;
  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));
  return {
    film: film as WatchFilm & { id: string; visible: boolean | null; backdrop_path: string | null },
    watch: (wpRow as (WatchData & { fetched_at?: string | null })) ?? null,
    ratings: (ratRow as WatchRatings) ?? null,
    takeScore: cx ? Math.round(cx.v - cx.r) : null,
    record: accessRecordFor((film as { tmdb_id: number | null }).tmdb_id),
    figures: (figRows ?? []) as FigLink[],
    videos,
  };
}

/* ── The rule-based report: every fact below is read off the stored data ── */

let regionNames: Intl.DisplayNames | null | undefined;
function countryName(code: string): string {
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { regionNames = null; }
  }
  try { return regionNames?.of(code) ?? code; } catch { return code; }
}

const listWords = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

type Report = {
  nCountries: number;
  freeSources: { platform: string; url: string; kind: string; scope: string }[];
  freeCountries: { code: string; provs: string[] }[];
  topProviders: { name: string; n: number }[];
  mubiYes: string[]; mubiRot: string[];
  spine: number | null; editions: number;
  leaving: { service: string; country: string; leaving_at: string | null }[];
  verdict: string | null;
  updated: string | null;
};

function buildReport(watch: (WatchData & { fetched_at?: string | null }) | null, record: AccessRecord | null): Report {
  const results = watch?.results ?? {};
  const codes = watch?.countries?.length ? watch.countries : Object.keys(results);
  const provCount = new Map<string, number>();
  const freeCountries: { code: string; provs: string[] }[] = [];
  for (const code of codes) {
    const o = results[code];
    if (!o) continue;
    for (const p of o.flatrate ?? []) provCount.set(p.provider_name, (provCount.get(p.provider_name) ?? 0) + 1);
    const freeProvs = [...(o.free ?? []), ...(o.ads ?? [])].map((p) => p.provider_name);
    if (freeProvs.length) freeCountries.push({ code, provs: [...new Set(freeProvs)] });
  }
  const topProviders = [...provCount.entries()].map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 3);
  const mubi = record?.mubi_by_country ?? {};
  const mubiYes = Object.keys(mubi).filter((c) => mubi[c] === "yes").map(countryName);
  const mubiRot = Object.keys(mubi).filter((c) => mubi[c] === "rot").map(countryName);
  const dates = [watch?.fetched_at, record?.checked_at].filter(Boolean) as string[];
  return {
    nCountries: codes.length,
    freeSources: (record?.free_sources ?? []).map((s) => ({ platform: s.platform, url: s.url, kind: s.kind, scope: s.scope })),
    freeCountries,
    topProviders,
    mubiYes, mubiRot,
    spine: record?.disc?.criterion_spine ?? null,
    editions: record?.disc?.editions?.length ?? 0,
    leaving: (record?.rotation ?? []).filter((r) => r.status === "leaving" || r.leaving_at)
      .map((r) => ({ service: r.service, country: countryName(r.country), leaving_at: r.leaving_at ?? null })),
    // verdict_note is sometimes an internal Korean research memo — only
    // surface it on this English page when it reads as English.
    verdict: (() => {
      const v = record?.verdict_note ?? null;
      if (!v) return null;
      const nonAscii = [...v].filter((ch) => ch.charCodeAt(0) > 127).length;
      return nonAscii / v.length < 0.1 ? v : null;
    })(),
    updated: dates.length ? dates.sort().reverse()[0].slice(0, 10) : null,
  };
}

/** The sexy subtitle — leads with the fact people actually search for. */
function dekText(title: string, r: Report): string {
  const bits: string[] = [];
  if (r.freeSources.length) bits.push(`free, legally, on ${listWords([...new Set(r.freeSources.map((s) => s.platform))].slice(0, 2))}`);
  else if (r.freeCountries.length) bits.push(`free with ads in ${r.freeCountries.length} countr${r.freeCountries.length === 1 ? "y" : "ies"}`);
  if (r.mubiYes.length) bits.push(`on MUBI in ${r.mubiYes.length} of the countries we check`);
  if (r.topProviders[0]) bits.push(`on ${r.topProviders[0].name} in ${r.topProviders[0].n} countr${r.topProviders[0].n === 1 ? "y" : "ies"}`);
  if (r.spine) bits.push(`Criterion spine #${r.spine} on disc`);
  const lead = bits.length ? `${title} is ${listWords(bits.slice(0, 3))}.` : `Every legal way to watch ${title}, country by country.`;
  return `${lead} The full ${r.nCountries}-country map, verified beyond the JustWatch matrix — archives checked, MUBI compared by country, disc editions on file.`;
}

function titleText(film: { title: string; year: number | null }, r: Report): string {
  const ty = `${film.title}${film.year ? ` (${film.year})` : ""}`;
  if (r.freeSources.length) return `Where to Watch ${ty} Free — Verified Archives + Streaming in ${r.nCountries} Countries`;
  if (r.mubiYes.length >= 3) return `Where to Watch ${ty} — MUBI in ${r.mubiYes.length} Countries, Full Streaming Map`;
  if (r.topProviders[0]) return `Where to Watch ${ty} — ${r.topProviders[0].name} & Every Service, ${r.nCountries} Countries`;
  return `Where to Watch ${ty} — Streaming, Free Archives, Disc & Subtitles`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };
  const { film, watch, record } = data;
  const report = buildReport(watch, record);
  const title = titleText(film, report);
  let description = dekText(`${film.title}${film.year ? ` (${film.year})` : ""}`, report);
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `/whereto/${slug}` },
    // Same gate as the film page: hidden (Tier-2) films' watch pages stay
    // crawlable but out of the index.
    robots: pageRobots(film.visible !== false),
  };
}

export default async function WhereToPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) {
    const alias = await resolveAlias(`/whereto/${slug}`);
    if (alias) permanentRedirect(alias);
    notFound();
  }
  const { film, watch, record, ratings, takeScore, figures, videos } = data;
  const titleYear = `${film.title}${film.year ? ` (${film.year})` : ""}`;
  const report = buildReport(watch, record);

  // One gallery still mid-page; the rest vary the bottom plates.
  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:whereto`, 4);
  const midStill = artPicks[0] ?? null;
  const plateArt = [...artPicks.slice(1), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  return (
    <div className="mt">
      <SiteNav />
      {/* The Movie @id points at /film/[slug] — the canonical entity home; this page is one surface of it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
          { "@type": "ListItem", position: 2, name: "Where to watch", item: "https://metatake.net/where-to-watch" },
          { "@type": "ListItem", position: 3, name: titleYear, item: `https://metatake.net/whereto/${film.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "Movie", "@id": `https://metatake.net/film/${film.slug}`,
          name: film.title, url: `https://metatake.net/whereto/${film.slug}`,
          ...(film.imdb_id ? { sameAs: [`https://www.imdb.com/title/${film.imdb_id}/`] } : {}) },
      ]) }} />

      <ReadHero
        film={{ title: film.title, slug: film.slug, year: film.year }}
        sharePath={`/whereto/${film.slug}`}
        shareTitle={`Where to watch ${titleYear}`}
        shareHook={dekText(film.title, report)}
        crumbTail="Where to watch"
        chip={<><Link href="/where-to-watch" style={{ color: "inherit", textDecoration: "none" }}>Where to Watch</Link>{" · "}beyond the matrix</>}
        meta={<>{report.nCountries} countries{report.updated ? ` · updated ${report.updated}` : ""}</>}
        title={<>Where to watch {titleYear}?</>}
        dek={dekText(film.title, report)}
        videos={videos}
        backdropPath={film.backdrop_path}
        tmdbId={film.tmdb_id}
      />

      <div className="mt-wrap" style={{ maxWidth: 880, padding: "24px 20px 8px" }}>
        <Byline created={report.updated ?? undefined} />
        <section style={{ margin: "10px 0 6px" }}>
          <h2 className="df-h2">The short version</h2>
          <div style={{ lineHeight: 1.7, maxWidth: "74ch", fontSize: 15.5 }}>
            {report.freeSources.length > 0 ? (
              <p>
                <b>Free, legally.</b>{" "}
                {report.freeSources.slice(0, 3).map((s, i) => (
                  <span key={s.url}>
                    {i > 0 ? " · " : ""}
                    <a href={s.url} target="_blank" rel="noopener">{s.platform} ↗</a>
                    <span style={{ opacity: 0.65 }}> ({s.kind}{s.scope ? `, ${s.scope}` : ""})</span>
                  </span>
                ))}{" "}
                — verified by Metatake, not scraped.
              </p>
            ) : record?.free_checked ? (
              <p><b>No verified free stream.</b> We checked the archives — nothing legal and free right now; the cheapest doors are below.</p>
            ) : null}
            {report.freeCountries.length > 0 ? (
              <p>
                <b>Free with ads</b> in {listWords(report.freeCountries.slice(0, 4).map((c) => countryName(c.code)))}
                {report.freeCountries.length > 4 ? ` and ${report.freeCountries.length - 4} more` : ""} — via{" "}
                {listWords([...new Set(report.freeCountries.flatMap((c) => c.provs))].slice(0, 3))}.
              </p>
            ) : null}
            {report.mubiYes.length > 0 || report.mubiRot.length > 0 ? (
              <p>
                <b>On MUBI:</b>{" "}
                {report.mubiYes.length ? <>streaming in {listWords(report.mubiYes.slice(0, 6))}{report.mubiYes.length > 6 ? ` and ${report.mubiYes.length - 6} more` : ""}</> : null}
                {report.mubiRot.length ? <>{report.mubiYes.length ? "; " : ""}rotates in and out in {listWords(report.mubiRot.slice(0, 3))}</> : null}
                . Checked country by country — MUBI catalogs differ everywhere.
              </p>
            ) : null}
            {report.topProviders.length > 0 ? (
              <p>
                <b>The subscription map.</b>{" "}
                {report.topProviders.map((p, i) => (
                  <span key={p.name}>{i > 0 ? " · " : ""}{p.name} carries it in <b>{p.n}</b> countr{p.n === 1 ? "y" : "ies"}</span>
                ))}
                {" "}— of the {report.nCountries} we track. Pick your country below for the full picture.
              </p>
            ) : null}
            {report.spine || report.editions > 0 ? (
              <p>
                <b>On disc:</b> {report.spine ? <>Criterion spine #{report.spine}</> : null}
                {report.editions > 0 ? <>{report.spine ? " · " : ""}{report.editions} edition{report.editions === 1 ? "" : "s"} on file</> : null}
                {" "}— details in the disc section below.
              </p>
            ) : null}
            {report.leaving.length > 0 ? (
              <p>
                <b>Leaving soon:</b>{" "}
                {report.leaving.slice(0, 2).map((l, i) => (
                  <span key={i}>{i > 0 ? " · " : ""}{l.service} ({l.country}){l.leaving_at ? ` — ${l.leaving_at}` : ""}</span>
                ))}
              </p>
            ) : null}
            {report.verdict ? <p><em>{report.verdict}</em></p> : null}
            {film.runtime ? <p><b>Runtime.</b> {titleYear} runs {film.runtime} minutes.</p> : null}
          </div>
        </section>

        {midStill ? (
          <figure className="rd-fig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://image.tmdb.org/t/p/w780${midStill}`} alt={`${film.title} still`} loading="lazy" width={780} height={439} />
            <figcaption>{titleYear} · via TMDB</figcaption>
          </figure>
        ) : null}
      </div>

      <AccessCountryProvider>
        <WatchPageClient film={film} watch={watch} record={record} ratings={ratings} takeScore={takeScore} />
      </AccessCountryProvider>

      <div className="axw-wrap">
        <section className="axw-section">
          <aside style={{ margin: "6px 0 14px", padding: "14px 16px", borderLeft: "3px solid #c0392b", background: "rgba(22,35,63,.04)", borderRadius: "0 6px 6px 0" }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>
              <b>Why this page is more than a provider grid.</b> The country matrix comes from JustWatch &amp; TMDB;
              on top of it, Metatake verifies what they don&apos;t carry — legal free archives, MUBI&apos;s
              country-by-country differences, disc editions and subtitle sources — and dates every check.
              {report.updated ? <> Sources last checked <b>{report.updated}</b>.</> : null}{" "}
              <Link href="/methodology">Methodology →</Link>
            </p>
          </aside>
          <Provenance created={report.updated ?? undefined} />
          {figures.length > 0 ? (
            <>
              <h2 className="axw-h2">The figures behind {film.title}</h2>
              <div className="axw-h2s">Once you know where to watch it — what it means. The anchors Metatake reads {titleYear} through.</div>
              <div className="rcp-list">
                {figures.map((f) => (
                  <div className="rcp-row" key={f.slug}>
                    <a className="rcp-h" href={`/film/${film.slug}/figure/${f.slug}`}>{f.label}</a>
                    <div className="rcp-m">Figure · {film.title}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <ReadPlates slug={film.slug} exclude="whereto" artPaths={plateArt} />
    </div>
  );
}
