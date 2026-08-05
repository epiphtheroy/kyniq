import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import { pageRobots } from "@/lib/seo";
import { FAMILIES, fw } from "@/lib/frameworks";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * The interpretive read-layer for one film, read as a single article.
 * (Moved 2026-07-16 from /film/[slug]/misreadings; the old route 308-redirects.)
 * No render-time LLM: every sentence already exists in the corpus (take_title + rationale
 * + leap per reading, plus the spoiler-free invitation as the lede). Answers
 * "{film} meaning / interpretation / analysis" queries. The cards on
 * /film/[slug]#df-readings stay untouched (full data on the film page, a focused
 * reading page on top).
 *
 * De-templated (2026-07-16): the opener strings that used to be identical across
 * every film — title, dek, the definitional intro paragraph, the closing — are
 * now assembled from THIS film's own strongest reading (take_title), its figures
 * and its framework mix, so no two films share a sentence. Still no render-time
 * LLM call (the corpus sentences it assembles are Metatake AI's own drafts).
 */
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Reading = {
  id: string; framework: string | null; title: string | null;
  rationale: string | null; leap: string | null; strength: number | null;
  figLabel: string; figSlug: string | null;
};

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: film, error: filmErr } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, visible, backdrop_path, poster_path, tmdb_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; visible: boolean; backdrop_path: string | null; poster_path: string | null; tmdb_id: number | null }>();
  if (filmErr) throw filmErr; // a failed query is not a missing row
  if (!film || !film.visible) return null;

  const { data: figRows } = await supabase
    .from("figures")
    .select("id, label, slug")
    .eq("film_id", film.id)
    .eq("status", "approved");
  const figById = new Map((figRows ?? []).map((f) => [f.id as string, f]));
  const figIds = [...figById.keys()];
  if (!figIds.length) return null;

  const [{ data: takeRows }, { data: vidRows }] = await Promise.all([
    supabase
      .from("takes")
      .select("id, figure_id, framework, take_title, rationale, leap, strength, is_invitation, created_at")
      .in("figure_id", figIds)
      .eq("status", "published"),
    supabase
      .from("media")
      .select("kind, external_id, title")
      .eq("entity_type", "film")
      .eq("entity_id", film.id)
      .eq("status", "published")
      .eq("kind", "video")
      .order("position"),
  ]);

  let invitation: string | null = null;
  let latest: string | null = null;
  const readings: Reading[] = [];
  for (const t of (takeRows ?? []) as { id: string; figure_id: string; framework: string | null; take_title: string | null; rationale: string | null; leap: string | null; strength: number | null; is_invitation: boolean; created_at: string }[]) {
    if (!latest || t.created_at > latest) latest = t.created_at;
    if (t.is_invitation) {
      if (!invitation) invitation = t.rationale;
      continue;
    }
    const f = figById.get(t.figure_id);
    readings.push({
      id: t.id, framework: t.framework, title: t.take_title,
      rationale: t.rationale, leap: t.leap, strength: t.strength,
      figLabel: (f?.label as string) ?? "", figSlug: (f?.slug as string | null) ?? null,
    });
  }
  if (!readings.length) return null;
  readings.sort((a, b) => {
    const fa = fw(a.framework), fb = fw(b.framework);
    const oa = FAMILIES.findIndex((x) => x.key === fa.family), ob = FAMILIES.findIndex((x) => x.key === fb.family);
    return oa - ob || fa.label.localeCompare(fb.label) || (b.strength ?? 0) - (a.strength ?? 0);
  });
  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));

  return {
    film: { title: film.title, slug: film.slug, year: film.year, director: film.director, director_slug: film.director_slug, backdrop_path: film.backdrop_path, poster_path: film.poster_path, tmdb_id: film.tmdb_id },
    invitation,
    readings,
    videos,
    latest: latest ? latest.slice(0, 10) : null,
  };
}

function load(slug: string) {
  // v3: route moved to /film/meaning/[slug] + de-templated openers (2026-07-16).
  // New cache key so the move doesn't serve the old templated payload.
  return unstable_cache(() => loadUncached(slug), ["film-meaning-3", slug], {
    revalidate: 3600,
    tags: [`film:${slug}`],
  })();
}

type Props = { params: Promise<{ slug: string }> };

const yStr = (y: number | null) => (y ? ` (${y})` : "");

function familyGroups(readings: Reading[]) {
  return FAMILIES
    .map((fam) => ({ fam, items: readings.filter((m) => fw(m.framework).family === fam.key) }))
    .filter((g) => g.items.length > 0);
}

// The single strongest reading with a title — the film-unique thesis surfaced in
// the title, dek and share hook. NOTE readings[] is family-ordered, so its first
// element is NOT the strongest; select by max strength independently.
function leadReading(readings: Reading[]): Reading | null {
  const titled = readings.filter((r) => r.title);
  const pool = titled.length ? titled : readings;
  return [...pool].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0] ?? null;
}

// Distinct figure labels in family order — the characters, objects, places and
// forms this film's readings anchor to. Used to make the intro film-specific.
function figureList(readings: Reading[]): string[] {
  return [...new Set(readings.map((r) => r.figLabel).filter(Boolean))];
}

// Trim a corpus phrase to a clean, punctuation-free fragment for headings/meta.
function clip(s: string, max: number): string {
  const t = s.trim().replace(/[.?!]+$/, "");
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// The film-unique page title: lead with the strongest thesis (interpretive by
// nature — it IS the film's meaning), fall back to a plain frame if untitled.
function pageTitle(film: { title: string; year: number | null }, lead: Reading | null, n: number): string {
  return lead?.title
    ? `${film.title}${yStr(film.year)}: ${clip(lead.title, 62)}`
    : `${film.title}${yStr(film.year)} — ${n} Strong Misreadings`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, readings } = data;
  const n = readings.length;
  const lead = leadReading(readings);
  const second = leadReading(readings.filter((r) => r.id !== lead?.id));
  const title = pageTitle(film, lead, n);
  // Keyword-bearing, film-specific description: the two strongest theses verbatim
  // (unique per film) + the "interpretations" intent keyword.
  let description = `${film.title}${yStr(film.year)} read ${n} way${n === 1 ? "" : "s"} against the grain${lead?.title ? `: “${clip(lead.title, 70)}”` : ""}${second?.title ? `, “${clip(second.title, 60)}”` : ""} — deliberate interpretations, each an argument the film can survive.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return {
    title,
    description,
    alternates: { canonical: `/film/meaning/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(n >= 5),
  };
}

export default async function FilmMeaningPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, invitation, readings, latest, videos } = data;
  const groups = familyGroups(readings);
  const anchors = new Map(readings.map((r, i) => [r.id, `r${i + 1}`]));
  const n = readings.length;
  const lead = leadReading(readings);
  const figs = figureList(readings);
  const firstFam = groups[0].fam.label.toLowerCase();
  const lastFam = groups[groups.length - 1].fam.label.toLowerCase();

  // TMDB gallery stills — one between each pair of family sections, the rest
  // vary the bottom plates. Deterministic per film+surface. Keep the ":misreadings"
  // seed literal so the moved page keeps its existing still picks.
  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:misreadings`, 8);
  const sectionArt = artPicks.slice(0, Math.max(0, groups.length - 1));
  const plateArt = [...artPicks.slice(sectionArt.length), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  const headline = pageTitle(film, lead, n);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/film/meaning/${film.slug}`,
    headline,
    description: lead?.title
      ? `${n} readings of ${film.title}, led by “${clip(lead.title, 80)}”.`
      : `${n} critical readings of ${film.title}, each an argument with a thesis.`,
    ...(latest ? { datePublished: latest, dateModified: latest } : {}),
    inLanguage: "en",
    about: { "@id": `https://metatake.net/film/${film.slug}` },
    isPartOf: { "@type": "WebSite", name: "Metatake", url: "https://metatake.net" },
    author: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
    publisher: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Films", item: "https://metatake.net/film" },
      { "@type": "ListItem", position: 2, name: `${film.title}${yStr(film.year)}`, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: 3, name: "Meaning & Interpretations", item: `https://metatake.net/film/meaning/${film.slug}` },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <ReadHero
        film={film}
        sharePath={`/film/meaning/${film.slug}`}
        shareTitle={`Strong Misreadings of ${film.title}${yStr(film.year)}`}
        shareHook={lead?.title
          ? `${clip(lead.title, 90)} — ${n} readings of ${film.title}${yStr(film.year)}`
          : `${n} deliberate readings of ${film.title}${yStr(film.year)}, each an argument`}
        crumbTail="Strong Misreadings"
        chip={<><Link href="/curious/misreadings" style={{ color: "inherit", textDecoration: "none" }}>Strong Misreadings</Link>{" · "}film by film</>}
        meta={<>{n} readings{latest ? ` · latest filed ${latest}` : ""}</>}
        title={<>Strong Misreadings of {film.title}{yStr(film.year)}</>}
        dek={
          <>
            {lead?.title ? <><em>{clip(lead.title, 96)}.</em>{" "}</> : null}
            {n} deliberate reading{n === 1 ? "" : "s"} of {film.title}{yStr(film.year)}
            {film.director ? <> — {film.director_slug ? <Link href={`/director/${film.director_slug}`}>{film.director}</Link> : film.director}&apos;s film</> : null}
            , read through its figures{figs[0] ? <>, from {figs[0]} outward</> : null}.
          </>
        }
        videos={videos}
        backdropPath={film.backdrop_path}
        tmdbId={film.tmdb_id}
      />

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline created={latest ?? undefined} />

          <div className="essay-body">
            {invitation ? <p><em>{invitation}</em></p> : null}
            <p>
              Below are all {n} <Link href="/about#strong-misreadings">strong misreadings</Link> of {film.title}
              {yStr(film.year)} in the live corpus — deliberate over-readings the film can survive, each anchored to
              a figure Metatake singles out{figs.length ? ` (${figs.slice(0, 3).join(", ")}${figs.length > 3 ? `, and ${figs.length - 3} more` : ""})` : ""}.
              {" "}{groups.length === 1
                ? <>They sit within {firstFam}.</>
                : <>They run from {firstFam} to {lastFam}, across {groups.length} framework families.</>}
              {" "}Written by Metatake AI, to a framework by <Link href="/editor">Wonwoo Yoon</Link>.
            </p>

            <p style={{ fontSize: "0.92em" }}>
              <b>In this article:</b>{" "}
              {readings.filter((r) => r.title).map((r, i) => (
                <span key={r.id}>
                  {i > 0 ? " · " : ""}
                  <a href={`#${anchors.get(r.id)}`}>{r.title}</a>
                </span>
              ))}
            </p>

            {groups.map(({ fam, items }, gi) => (
              <section key={fam.key}>
                {gi > 0 && sectionArt[gi - 1] ? (
                  <figure className={`rd-fig${gi % 2 === 0 ? " rd-fig--inset" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://image.tmdb.org/t/p/w780${sectionArt[gi - 1]}`} alt={`${film.title} still`} loading="lazy" width={780} height={439} />
                    <figcaption>{film.title}{yStr(film.year)} · via TMDB</figcaption>
                  </figure>
                ) : null}
                <h2>{fam.label}</h2>
                {items.map((m) => {
                  const F = fw(m.framework);
                  return (
                    <section key={m.id} id={anchors.get(m.id)}>
                      <h3>{m.title ?? `${F.label} — via ${m.figLabel}`}</h3>
                      <p style={{ fontSize: "0.85em", opacity: 0.75, marginTop: "-0.4em" }}>
                        <span style={{ color: F.color, fontWeight: 600 } as CSSProperties}>
                          {F.slug ? <Link href={`/strong-misreadings/${F.slug}`} style={{ color: "inherit" }}>{F.label}</Link> : F.label}
                        </span>
                        {" · via "}
                        {m.figSlug ? <Link href={`/film/${film.slug}/figure/${m.figSlug}`}>{m.figLabel}</Link> : m.figLabel}
                      </p>
                      {m.rationale ? <p>{m.rationale}</p> : null}
                      {m.leap ? <p><strong>The leap.</strong> {m.leap}</p> : null}
                    </section>
                  );
                })}
              </section>
            ))}

            <hr />
            <p>
              These are readings of {film.title}, not claims about what {film.director ?? "its makers"} intended —
              arguments the film can survive. Each anchors to a figure you can follow across cinema; browse the{" "}
              <Link href="/strong-misreadings">14 frameworks</Link> behind them, or every film&apos;s readings on{" "}
              <Link href="/curious/misreadings">Curious</Link>.
            </p>
          </div>

          <Provenance created={latest ?? undefined} />

          <p style={{ marginTop: 24 }}>
            <Link href={`/film/${film.slug}`}>← Everything on {film.title}{yStr(film.year)}</Link>
          </p>
        </article>
      </div>

      <ReadPlates slug={film.slug} exclude="misreadings" artPaths={plateArt} />
    </div>
  );
}
