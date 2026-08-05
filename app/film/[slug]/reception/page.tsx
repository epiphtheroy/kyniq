import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import AfterlifeNav from "@/components/read/AfterlifeNav";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import { pageRobots } from "@/lib/seo";
import { filmMainIndexable } from "@/lib/filmGate";
import { honorText, type FilmLineageRow } from "@/lib/lineage";
import "@/app/curious/curious.css";
import "../read.css";

/**
 * The afterlife of one film, year by year (2026-07-08) — the reception layer
 * promoted from a buried card list to an article. LLM-free assembly from four
 * dated sources: film_reception (headlines + publishers' own link-preview
 * paragraphs, review_year recovered from URLs), film_release_events (TMDB
 * premiere/theatrical/digital/physical/TV), film_wd_honors (Wikidata
 * award/nomination statements) and the internal lineage record (edition_year,
 * linked to /lineage hubs). Copyright rule unchanged: headlines + publisher
 * link-preview text only, every item links out to its source.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Rcp = {
  kind: string; outlet: string; critic: string | null; tier: string;
  headline: string; verdict: string | null; dek_lead: string | null;
  review_year: number | null; url: string; created_at: string;
};
type Ev = { country: string; event_type: string; event_date: string; note: string | null };
type Wd = { kind: string; label: string; event_date: string | null; year_only: boolean };

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: film, error: filmErr } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, visible, backdrop_path, poster_path, tmdb_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; visible: boolean; backdrop_path: string | null; poster_path: string | null; tmdb_id: number | null }>();
  if (filmErr) throw filmErr; // a failed query is not a missing row
  if (!film) return null;

  const [{ data: rcp }, { data: ev }, { data: wd }, { data: ln }, { data: vidRows }] = await Promise.all([
    supabase.from("film_reception")
      .select("kind, outlet, critic, tier, headline, verdict, dek_lead, review_year, url, created_at")
      .eq("film_id", film.id).order("position"),
    supabase.from("film_release_events")
      .select("country, event_type, event_date, note")
      .eq("film_id", film.id).order("event_date"),
    supabase.from("film_wd_honors")
      .select("kind, label, event_date, year_only")
      .eq("film_id", film.id).order("event_date"),
    supabase.rpc("film_lineage_for", { p_film_id: film.id }),
    supabase.from("media").select("kind, external_id, title")
      .eq("entity_type", "film").eq("entity_id", film.id)
      .eq("status", "published").eq("kind", "video").order("position"),
  ]);
  const reception = (rcp ?? []) as Rcp[];
  const wdHonors = (wd ?? []) as Wd[];
  const lnAwards = ((ln ?? []) as FilmLineageRow[]).filter((l) => l.edition_year && (l.facet === "award" || l.facet === "festival" || l.facet === "section"));
  // Publish only with genuine afterlife substance — critical reception OR an
  // honors record. Release dates alone (nearly every film has them) don't make
  // an afterlife article, so a bare release ledger stays unpublished (404).
  if (!reception.length && !wdHonors.length && !lnAwards.length) return null;

  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));
  let latest: string | null = null;
  for (const r of reception) if (!latest || r.created_at > latest) latest = r.created_at;

  return {
    film: { title: film.title, slug: film.slug, year: film.year, director: film.director, director_slug: film.director_slug, backdrop_path: film.backdrop_path, poster_path: film.poster_path, tmdb_id: film.tmdb_id },
    reception,
    events: (ev ?? []) as Ev[],
    wdHonors,
    lineage: lnAwards,
    videos,
    latest: latest ? latest.slice(0, 10) : null,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["film-afterlife-1", slug], {
    revalidate: 3600,
    tags: [`film:${slug}`],
  })();
}

type Props = { params: Promise<{ slug: string }> };

const yStr = (y: number | null) => (y ? ` (${y})` : "");
const REGION = new Intl.DisplayNames(["en"], { type: "region" });
const cname = (cc: string) => { try { return REGION.of(cc) ?? cc; } catch { return cc; } };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${day}, ${y}`;
};
const EV_LABEL: Record<string, string> = {
  premiere: "Premiere", theatrical_limited: "Limited theatrical", theatrical: "Theatrical",
  digital: "Digital", physical: "Home video", tv: "Television",
};

/** Year-bucketed timeline entry — pure data, rendered below. */
type Entry =
  | { t: "release"; text: string }
  | { t: "honor"; text: string; href?: string; won: boolean }
  | { t: "review"; r: Rcp }
  | { t: "paper"; r: Rcp };

const normWords = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.3) ─────────
// Deterministic Q&A from the dated rows already in scope. Every date and
// country is verbatim from a real release-event row; critic quotes are the
// publishers' own verbatim headlines/link-previews, attributed. GAP (never
// emitted): aggregate scores — no Rotten Tomatoes / Metacritic / star-rating
// question, because that data is not on this page (tier is internal). No full
// review body either. Search-term variants are woven, max two uses each:
// "premiere" (Q1), "released" (Q2 + Q4), "come out" (Q3), "release date" (A2).
function receptionQuickAnswers(
  film: { title: string },
  events: Ev[],
  countries: string[],
  reviews: Rcp[],
  papers: Rcp[],
): QuickAnswerItem[] {
  const items: QuickAnswerItem[] = [];
  const byDate = (list: Ev[]) => [...list].sort((a, b) => a.event_date.localeCompare(b.event_date));
  // 1 — premiere (earliest premiere row, named by country).
  const premieres = byDate(events.filter((e) => e.event_type === "premiere"));
  if (premieres.length) {
    const p = premieres[0];
    items.push({
      q: `When did ${film.title} premiere?`,
      a: `${film.title} premiered in ${cname(p.country)} on ${fmtDate(p.event_date)}${p.note ? ` (${p.note})` : ""}.`,
    });
  }
  // 2 — first theatrical opening (real event row, by country).
  const theatrical = byDate(events.filter((e) => e.event_type === "theatrical" || e.event_type === "theatrical_limited"));
  if (theatrical.length) {
    const t = theatrical[0];
    const where = t.country ? cname(t.country) : null;
    items.push({
      q: `When was ${film.title} released${where ? ` in ${where}` : ""}?`,
      a: `${film.title}'s theatrical release date${where ? ` in ${where}` : ""} was ${fmtDate(t.event_date)}.`,
    });
  }
  // 3 — digital / physical window, with the note (4K, platform…) verbatim.
  const later = byDate(events.filter((e) => e.event_type === "digital" || e.event_type === "physical"));
  if (later.length) {
    const d = later[0];
    const kind = d.event_type === "digital" ? "Digital" : "Home video";
    items.push({
      q: `When did ${film.title} come out on streaming or Blu-ray?`,
      a: `${kind} release${d.note ? ` (${d.note})` : ""}: ${fmtDate(d.event_date)}${d.country ? ` in ${cname(d.country)}` : ""}.`,
    });
  }
  // 4 — country count (only when it genuinely spans more than one).
  if (countries.length > 1) {
    items.push({
      q: `In how many countries was ${film.title} released?`,
      a: `${film.title} has dated release events in ${countries.length} countries and territories on TMDB's ledger.`,
    });
  }
  // 5 — what critics said: one or two verbatim, attributed publisher headlines.
  const crit = reviews.filter((r) => (r.headline || r.dek_lead || "").trim()).slice(0, 2);
  if (crit.length) {
    const quote = (r: Rcp) => (r.headline || r.dek_lead || "").trim();
    items.push({
      q: `What did critics say about ${film.title}?`,
      a: (
        <>
          {crit.map((r, i) => (
            <span key={i}>
              {i > 0 ? "; " : ""}
              {r.outlet} called it “{quote(r)}”{r.critic ? ` (${r.critic})` : ""}
            </span>
          ))}
          {papers.length > 0 ? <>, and {papers.length} academic {papers.length === 1 ? "study engages" : "studies engage"} it.</> : "."}
        </>
      ),
    });
  }
  return items.slice(0, 5);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, reception, events, wdHonors, lineage } = data;
  const reviews = reception.filter((r) => r.kind === "criticism");
  const papers = reception.filter((r) => r.kind === "academic");
  // Reviews-led framing when critics exist; honors-led when they don't (the
  // substance gate guarantees a no-review page still carries an honors record).
  const hasReviews = reviews.length > 0;
  const honorsN = wdHonors.length + lineage.length;
  const years = [
    ...events.map((e) => Number(e.event_date.slice(0, 4))),
    ...reception.map((r) => r.review_year ?? 0),
  ].filter((y) => y > 1880);
  const y0 = years.length ? Math.min(...years) : film.year;
  const y1 = years.length ? Math.max(...years) : film.year;
  const span = y0 && y1 && y1 > (y0 ?? 0) ? `, ${y0}–${y1}` : "";
  const title = `${film.title}${yStr(film.year)} ${hasReviews ? "Reviews & Afterlife" : "Awards & Afterlife"} — Year by Year${span}`;
  const outlets = [...new Set(reviews.map((r) => r.outlet))];
  let description = hasReviews
    ? `What critics said about ${film.title} — ${reviews.length} review${reviews.length === 1 ? "" : "s"} from ${outlets.slice(0, 3).join(", ")}${outlets.length > 3 ? " and more" : ""}${papers.length ? `, ${papers.length} scholarly paper${papers.length === 1 ? "" : "s"}` : ""}, plus its releases, honors and revivals, dated and sourced.`
    : `The awards, releases and afterlife of ${film.title}${yStr(film.year)} — ${honorsN} honor${honorsN === 1 ? "" : "s"}${events.length ? ", its release history" : ""} and revivals, dated and sourced.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return {
    title, description,
    alternates: { canonical: `/film/${slug}/reception` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    // Index bar raised 3 -> 8 (2026-07-16): a reception page earns an index slot
    // only with a substantial critic+scholarship+honors archive; thinner films
    // still render for direct visitors but stay out of the index (sitemap mirrors
    // this exact filtered >=8 sum in filmReceptionEntries).
    robots: pageRobots((await filmMainIndexable(slug)) && (reviews.length + papers.length + wdHonors.length + lineage.length >= 8)),
  };
}

export default async function FilmReceptionPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, reception, events, wdHonors, lineage, videos, latest } = data;
  const reviews = reception.filter((r) => r.kind === "criticism");
  const papers = reception.filter((r) => r.kind === "academic");
  const outlets = [...new Set(reviews.map((r) => r.outlet))];
  const countries = [...new Set(events.map((e) => e.country))];
  const hasReviews = reviews.length > 0;
  const honorsN = wdHonors.length + lineage.length;

  // ── Assemble the year buckets ──
  const byYear = new Map<number, Entry[]>();
  const push = (y: number, e: Entry) => byYear.set(y, [...(byYear.get(y) ?? []), e]);

  // Release events: one sentence per (year, type); theatrical types summarize
  // the rollout, later windows name countries + notes (4K, Netflix…).
  const evByYearType = new Map<string, Ev[]>();
  for (const e of events) {
    const k = `${e.event_date.slice(0, 4)}|${e.event_type === "theatrical_limited" ? "theatrical" : e.event_type}`;
    evByYearType.set(k, [...(evByYearType.get(k) ?? []), e]);
  }
  for (const [k, list] of evByYearType) {
    const [ys, type] = k.split("|");
    const y = Number(ys);
    if (!(y > 1880)) continue;
    list.sort((a, b) => a.event_date.localeCompare(b.event_date));
    const first = list[0];
    const ccs = [...new Set(list.map((e) => e.country))];
    const notes = [...new Set(list.map((e) => e.note).filter(Boolean))] as string[];
    let text: string;
    if (type === "premiere") {
      text = `Premiere${list.length > 1 ? "s" : ""}: ${list.slice(0, 3).map((e) => `${cname(e.country)}, ${fmtDate(e.event_date)}${e.note ? ` (${e.note})` : ""}`).join("; ")}.`;
    } else if (type === "theatrical") {
      text = `Opened theatrically in ${cname(first.country)} on ${fmtDate(first.event_date)}${ccs.length > 1 ? `, reaching ${ccs.length} countries and territories that year` : ""}.`;
    } else {
      text = `${EV_LABEL[type] ?? type}: ${ccs.slice(0, 6).map(cname).join(", ")}${ccs.length > 6 ? ` and ${ccs.length - 6} more` : ""}${notes.length ? ` — ${notes.slice(0, 3).join(", ")}` : ""} (first: ${fmtDate(first.event_date)}).`;
    }
    push(y, { t: "release", text });
  }

  // Honors: the internal lineage record first (linked), then Wikidata honors
  // that the lineage doesn't already state (word-overlap dedupe).
  const lnTexts: { y: number; words: Set<string> }[] = [];
  for (const l of lineage) {
    const y = l.edition_year as number;
    const text = `${l.result ? `${l.result[0].toUpperCase()}${l.result.slice(1)}` : "Honored"} — ${honorText(l)}.`;
    lnTexts.push({ y, words: normWords(`${l.parent_label ?? ""} ${l.list_label} ${l.result ?? ""}`) });
    push(y, { t: "honor", text, href: `/lineage/${l.list_slug}`, won: /win|won|winner/i.test(l.result ?? "") });
  }
  const undatedHonors: { text: string; won: boolean }[] = [];
  for (const w of wdHonors) {
    const y = w.event_date ? Number(w.event_date.slice(0, 4)) : null;
    if (!y || !(y > 1880)) {
      // No point-in-time on the statement — list it without a year claim.
      const words0 = normWords(w.label);
      const dup0 = lnTexts.some((l) => [...words0].filter((x) => l.words.has(x)).length >= Math.max(2, Math.floor(words0.size * 0.6)));
      if (!dup0) undatedHonors.push({ text: w.kind === "award" ? `Won the ${w.label}.` : `Nominated for the ${w.label}.`, won: w.kind === "award" });
      continue;
    }
    const words = normWords(w.label);
    const dup = lnTexts.some((l) => Math.abs(l.y - y) <= 1 && [...words].filter((x) => l.words.has(x)).length >= Math.max(2, Math.floor(words.size * 0.6)));
    if (dup) continue;
    const text = w.kind === "award"
      ? `Won the ${w.label}${!w.year_only && w.event_date ? ` on ${fmtDate(w.event_date)}` : ""}.`
      : `Nominated for the ${w.label}${!w.year_only && w.event_date ? ` (announced ${fmtDate(w.event_date)})` : ""}.`;
    push(y, { t: "honor", text, won: w.kind === "award" });
  }

  for (const r of reviews) if (r.review_year) push(r.review_year, { t: "review", r });
  for (const r of papers) if (r.review_year) push(r.review_year, { t: "paper", r });
  const undated = reviews.filter((r) => !r.review_year);

  const years = [...byYear.keys()].sort((a, b) => a - b);

  // Grouped render inside each year card — the group IS the visual unit.
  const GROUPS: { t: Entry["t"]; label: string; color: string }[] = [
    { t: "release", label: "Releases & revivals", color: "#2F6DB0" },
    { t: "honor", label: "Honors", color: "#B8863B" },
    { t: "review", label: "Reviews", color: "#D64534" },
    { t: "paper", label: "Scholarship", color: "#12897A" },
  ];
  const DECADE_COLORS = ["#D64534", "#C87A2C", "#B8863B", "#6B4E9E", "#2F6DB0", "#12897A", "#B85C9E", "#4E7088"];
  const yearColor = (y: number) => DECADE_COLORS[Math.floor(y / 10) % DECADE_COLORS.length];

  const countBy = (t: Entry["t"]) => years.reduce((s, y) => s + byYear.get(y)!.filter((e) => e.t === t).length, 0);
  const navYears = [
    ...years.map((y) => ({ id: `y${y}`, label: String(y), n: byYear.get(y)!.length, color: yearColor(y) })),
    ...(undated.length + undatedHonors.length ? [{ id: "undated", label: "On the record", n: undated.length + undatedHonors.length, color: "#5A6B86" }] : []),
  ];
  const navModes = [
    { key: "all", label: "Everything", n: 0, color: "#5A6B86" },
    { key: "release", label: "Releases", n: countBy("release"), color: "#2F6DB0" },
    { key: "honor", label: "Honors", n: countBy("honor") + undatedHonors.length, color: "#B8863B" },
    { key: "review", label: "Reviews", n: countBy("review") + undated.length, color: "#D64534" },
    { key: "paper", label: "Scholarship", n: countBy("paper"), color: "#12897A" },
  ];

  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:reception`, 6);
  const midArt = artPicks.slice(0, Math.max(0, Math.min(2, years.length - 1)));
  const plateArt = [...artPicks.slice(midArt.length), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  const headline = `${film.title}${yStr(film.year)} ${hasReviews ? "Reviews & Afterlife" : "Awards & Afterlife"} — Year by Year`;
  const metaBits = [
    hasReviews ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : null,
    papers.length ? `${papers.length} paper${papers.length === 1 ? "" : "s"}` : null,
    honorsN ? `${honorsN} honor${honorsN === 1 ? "" : "s"}` : null,
    countries.length ? `${countries.length} countr${countries.length === 1 ? "y" : "ies"}` : null,
    years.length > 1 && years[years.length - 1] > years[0] ? `${years[0]}–${years[years.length - 1]}` : null,
  ].filter(Boolean).join(" · ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/film/${film.slug}/reception`,
    headline,
    description: `The public life of ${film.title}: reviews, honors, releases and revivals, dated and sourced.`,
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
      { "@type": "ListItem", position: 3, name: "Reviews & Afterlife", item: `https://metatake.net/film/${film.slug}/reception` },
    ],
  };

  const y0 = years[0] ?? film.year;
  const y1 = years[years.length - 1] ?? film.year;
  let artUsed = 0;

  const Quote = ({ r }: { r: Rcp }) => {
    const q = r.dek_lead || r.verdict;
    return q ? <p className="afl-q">“{q}”</p> : null;
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <ReadHero
        film={film}
        sharePath={`/film/${film.slug}/reception`}
        shareTitle={`${film.title}${yStr(film.year)} — Reviews & Afterlife`}
        shareHook={`${film.title}${yStr(film.year)} — ${reviews.length} reviews, ${wdHonors.length + lineage.length} honors, every release and revival, year by year`}
        crumbTail={hasReviews ? "Reviews & Afterlife" : "Awards & Afterlife"}
        chip={<>{hasReviews ? "Reception" : "Afterlife"} · the record</>}
        meta={<>{metaBits}</>}
        title={<>{film.title}{yStr(film.year)} — {hasReviews ? "What Critics Said, and Everything Since" : "Its Honors, Releases and Afterlife"}</>}
        dek={
          <>
            The public life of {film.title}
            {film.director ? <> — {film.director_slug ? <Link href={`/director/${film.director_slug}`}>{film.director}</Link> : film.director}&apos;s film</> : null}
            {" "}— year by year: {[
              hasReviews ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}` : null,
              papers.length ? `${papers.length} scholarly paper${papers.length === 1 ? "" : "s"}` : null,
              honorsN ? "its honors" : null,
              events.length ? "every release and revival Metatake can date" : null,
            ].filter(Boolean).join(", ")}. Every item links to its source.
          </>
        }
        videos={videos}
        backdropPath={film.backdrop_path}
        tmdbId={film.tmdb_id}
      />

      <AfterlifeNav years={navYears} modes={navModes} />

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline created={latest ?? undefined} />

          <div className="essay-body">
            <p>
              A film&apos;s release is the start of its life, not the end. Below is the record for {film.title}
              {yStr(film.year)}, assembled from {hasReviews ? <>the publishers&apos; own headlines and link previews, </> : null}TMDB&apos;s
              release ledger, Wikidata&apos;s award record and Metatake&apos;s lineage archive — dated, sourced,
              and in order.{hasReviews ? <> Quotes are verbatim from publishers&apos; link previews and paper abstracts; no article text is stored.</> : null}
            </p>
            <QuickAnswers items={receptionQuickAnswers(film, events, countries, reviews, papers)} />
            {years.map((y, yi) => (
              <section key={y} id={`y${y}`} data-af-year className="afl-year" style={{ "--yc": yearColor(y) } as React.CSSProperties}>
                {yi > 0 && yi % Math.max(2, Math.ceil(years.length / (midArt.length + 1))) === 0 && artUsed < midArt.length ? (
                  <figure className="rd-fig" style={{ marginTop: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://image.tmdb.org/t/p/w780${midArt[artUsed++]}`} alt={`${film.title} still`} loading="lazy" width={780} height={439} />
                    <figcaption>{film.title}{yStr(film.year)} · via TMDB</figcaption>
                  </figure>
                ) : null}
                <h2 className="afl-h2">
                  <span className="afl-dot" aria-hidden />
                  {y}{y === film.year ? " — the release" : ""}
                  <span className="afl-yn">{byYear.get(y)!.length} {byYear.get(y)!.length === 1 ? "entry" : "entries"}</span>
                </h2>
                {GROUPS.map((g) => {
                  const items = byYear.get(y)!.filter((e) => e.t === g.t);
                  if (!items.length) return null;
                  return (
                    <div key={g.t} className="afl-grp">
                      <div className="afl-k" data-af={g.t} style={{ "--kc": g.color } as React.CSSProperties}>{g.label}</div>
                      {items.map((e, i) => {
                        if (e.t === "release") return <p key={i} className="afl-ev" data-af="release">{e.text}</p>;
                        if (e.t === "honor") return (
                          <p key={i} className="afl-ev afl-ev--honor" data-af="honor">
                            <span aria-hidden>{e.won ? "🏆" : "◇"}</span>{" "}
                            {e.href ? <Link href={e.href}>{e.text}</Link> : e.text}
                          </p>
                        );
                        const r = e.r;
                        return (
                          <section key={i} className="afl-item" data-af={e.t}>
                            <h3 className="afl-h3">
                              <a href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
                            </h3>
                            <p className="afl-src">{r.outlet}{r.critic ? ` · ${r.critic}` : ""}</p>
                            <Quote r={r} />
                          </section>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            ))}

            {undated.length || undatedHonors.length ? (
              <section id="undated" data-af-year className="afl-year" style={{ "--yc": "#5A6B86" } as React.CSSProperties}>
                <h2 className="afl-h2">
                  <span className="afl-dot" aria-hidden />
                  Also on the record
                  <span className="afl-yn">{undated.length + undatedHonors.length} {undated.length + undatedHonors.length === 1 ? "entry" : "entries"}</span>
                </h2>
                <p style={{ fontSize: "0.92em", opacity: 0.8 }}>
                  Items whose exact date isn&apos;t machine-recoverable from the source — listed without a year claim.
                </p>
                {undatedHonors.length ? (
                  <div className="afl-grp">
                    <div className="afl-k" data-af="honor" style={{ "--kc": "#B8863B" } as React.CSSProperties}>Honors</div>
                    {undatedHonors.map((h, i) => (
                      <p key={`h${i}`} className="afl-ev afl-ev--honor" data-af="honor"><span aria-hidden>{h.won ? "🏆" : "◇"}</span> {h.text}</p>
                    ))}
                  </div>
                ) : null}
                {undated.length ? (
                  <div className="afl-grp">
                    <div className="afl-k" data-af="review" style={{ "--kc": "#D64534" } as React.CSSProperties}>Reviews</div>
                    {undated.map((r, i) => (
                      <section key={i} className="afl-item" data-af="review">
                        <h3 className="afl-h3">
                          <a href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
                        </h3>
                        <p className="afl-src">{r.outlet}{r.critic ? ` · ${r.critic}` : ""}</p>
                        <Quote r={r} />
                      </section>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <hr />
            <p>
              Sources: publishers&apos; own link previews (og:description) and paper abstracts via OpenAlex/Crossref;
              release dates via <a href="https://www.themoviedb.org" target="_blank" rel="noopener nofollow">TMDB</a>;
              award statements via <a href="https://www.wikidata.org" target="_blank" rel="noopener nofollow">Wikidata</a>;
              canon and festival record from Metatake&apos;s <Link href="/lineage">lineage archive</Link>.
              Compiled from cited sources · no language model · designed by <Link href="/editor">Wonwoo Yoon</Link> — <Link href="/methodology">how we work →</Link>
            </p>
          </div>

          <Provenance created={latest ?? undefined} />

          <p style={{ marginTop: 24 }}>
            <Link href={`/film/${film.slug}`}>← Everything on {film.title}{yStr(film.year)}</Link>
          </p>
        </article>
      </div>

      <ReadPlates slug={film.slug} exclude="reception" artPaths={plateArt} />
    </div>
  );
}
