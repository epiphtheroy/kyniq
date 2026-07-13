import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import ShareDock from "@/components/ShareDock";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import ReadPlates from "@/components/read/ReadPlates";
import "@/app/curious/curious.css";
import { pageRobots } from "@/lib/seo";
import { awardBody, awardLabel, canonEmblem } from "@/lib/lineageBodies";
import { cachedLocationsEligibility } from "@/lib/locations";
import {
  FILM_HONORS_MIN,
  cachedLineageMeta,
  honorText,
  lineageSource,
  loadLineageListMeta,
  wikidataUrl,
  type FilmLineageRow,
  type LineageListMeta,
} from "@/lib/lineage";

/**
 * /film/lineage/[slug] — the film's complete lineage record (awards, canons,
 * national honours, auteur line), each entry linking to the list it belongs
 * to WITH its source. The film page keeps its compact Lineage section; this
 * is the read page for "X awards" / "is X in the canon" queries.
 * (Moved 2026-07-06 from /film/[slug]/honors — the old route 308-redirects.)
 *
 * Deliberately NOT gated on films.visible: a Tier-2 catalog film with three
 * sourced honours carries a real record — the honours are facts about the
 * film, not editorial that needs the ≥3-figure bar. Gate: ≥3 lineage rows.
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type FilmRow = {
  id: string; title: string; slug: string; year: number | null;
  director: string | null; director_slug: string | null;
  poster_path: string | null; visible: boolean | null;
  release_date: string | null; imdb_id: string | null;
  tmdb_id: number | null; wikidata_id: string | null;
};

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, poster_path, visible, release_date, imdb_id, tmdb_id, wikidata_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!film) return null;
  const { data: rows } = await supabase.rpc("film_lineage_for", { p_film_id: (film as FilmRow).id });
  const lineage = ((rows ?? []) as FilmLineageRow[]);
  if (lineage.length < FILM_HONORS_MIN) return null;
  const listMeta = await loadLineageListMeta([...new Set(lineage.map((l) => l.list_slug))]);
  const locElig = await cachedLocationsEligibility();
  return {
    film: film as FilmRow,
    lineage,
    listMeta: Object.fromEntries(listMeta), // Data Cache can't serialize Maps
    hasLocationsPage: locElig.films.some((f) => f.slug === slug),
  };
}

function load(slug: string) {
  // Key bumped (2) when the entity ids joined the payload — the Data Cache
  // outlives deploys.
  return unstable_cache(() => loadUncached(slug), ["film-honors2", slug], {
    revalidate: 86400,
    tags: [`film:${slug}`],
  })();
}

function splitRows(lineage: FilmLineageRow[]) {
  const awards = lineage
    .filter((l) => l.facet !== "auteur" && l.result !== "listed" && l.result)
    .sort((a, b) => (b.edition_year ?? 0) - (a.edition_year ?? 0));
  const canons = lineage
    .filter((l) => l.facet === "canon" && l.result === "listed")
    .sort((a, b) => (a.rank ?? 9e9) - (b.rank ?? 9e9) || a.list_label.localeCompare(b.list_label));
  const national = lineage
    .filter((l) => l.facet === "national" && l.result === "listed")
    .sort((a, b) => a.list_label.localeCompare(b.list_label));
  const auteur = lineage.filter((l) => l.facet === "auteur");
  const rest = lineage.filter((l) => !awards.includes(l) && !canons.includes(l) && !national.includes(l) && !auteur.includes(l));
  return { awards, canons: [...canons, ...rest], national, auteur };
}

function leadText(film: FilmRow, lineage: FilmLineageRow[]): string {
  const { awards, canons, national, auteur } = splitRows(lineage);
  const year = film.year ? ` (${film.year})` : "";
  const parts: string[] = [];
  if (awards.length) {
    const top = awards[0];
    parts.push(`${awards.length} award result${awards.length === 1 ? "" : "s"} — most recently ${top.result === "won" ? "winning" : top.result ?? ""} the ${awardLabel(top.list_label, top.list_slug)}${top.edition_year ? ` in ${top.edition_year}` : ""}`);
  }
  if (canons.length) {
    const ranked = canons.find((c) => c.rank != null);
    parts.push(`${canons.length} canon appearance${canons.length === 1 ? "" : "s"}${ranked ? ` (ranked #${ranked.rank}${ranked.rank_max ? ` of ${ranked.rank_max}` : ""} in ${ranked.list_label})` : ""}`);
  }
  if (national.length) parts.push(`${national.length} national canon${national.length === 1 ? "" : "s"}`);
  if (auteur.length) parts.push(`an auteur line`);
  const body = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
  return `${film.title}${year} carries ${lineage.length} entries in Metatake's lineage record: ${body}. Every entry links to the complete list it belongs to, with the source it was compiled from.`;
}

// A readable, verbatim award name from one lineage row: the festival grand
// prize is self-identifying (e.g. "Palme d'Or"); otherwise the awarding body,
// derived deterministically from the slug (same map that picks the emblem), is
// prefixed so a bare category ("Best Picture") reads unambiguously.
function awardName(l: FilmLineageRow): string {
  const label = awardLabel(l.list_label, l.list_slug);
  const parent = l.parent_label && l.parent_label !== l.list_label ? l.parent_label : null;
  if (parent) return label;
  const body = awardBody(l.list_slug)?.name;
  return body && !label.toLowerCase().includes(body.toLowerCase()) ? `${body} for ${label}` : label;
}

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.2) ─────────
// Deterministic Q&A from the lineage rows already in scope. TRAP GUARDS: rows
// are FILM-level (no person) so a question never says "which actor/director
// won"; and edition_year is the AWARD year, kept distinct from the film's
// release year (yearLabel, shown in parens after the title). Search-term
// variants "win / won / awards / honours" are woven, max two uses each (entity
// names carrying "Award" are verbatim per §0.2 and exempt from the tally).
function quickAnswerItems(film: FilmRow, lineage: FilmLineageRow[]): QuickAnswerItem[] {
  const { awards, canons } = splitRows(lineage);
  const yearLabel = film.year ? ` (${film.year})` : "";
  const won = awards.filter((a) => a.result === "won");
  const nominated = awards.filter((a) => a.result === "nominated");
  const items: QuickAnswerItem[] = [];
  // 1 — the head "what did X win" query: won rows, verbatim, with award years.
  if (won.length > 0) {
    const named = won.map((l) => `${awardName(l)}${l.edition_year ? ` (${l.edition_year})` : ""}`);
    const head = named.slice(0, 3).join(", ");
    const more = named.length > 3 ? ` and ${named.length - 3} more` : "";
    items.push({ q: `What awards did ${film.title} win?`, a: `${film.title}${yearLabel} claimed ${head}${more}.` });
  }
  // 2 — the flagship yes/no (top won row = the most recent award edition).
  if (won.length > 0) {
    const top = won[0];
    items.push({
      q: `Did ${film.title} win the ${awardName(top)}?`,
      a: `Yes — ${film.title}${yearLabel} won the ${awardName(top)}${top.edition_year ? ` in ${top.edition_year}` : ""}.`,
    });
  }
  // 3 — nomination (no 'nominated' rows in the current data, so this is dormant).
  if (nominated.length > 0) {
    const nom = nominated[0];
    items.push({
      q: `Was ${film.title} nominated for the ${awardName(nom)}?`,
      a: `Yes — ${film.title}${yearLabel} was nominated for the ${awardName(nom)}${nom.edition_year ? ` in ${nom.edition_year}` : ""}.`,
    });
  }
  // 4 — canon membership, with rank/rank_max verbatim when present.
  if (canons.length > 0) {
    const c = canons[0];
    const cname = awardLabel(c.list_label, c.list_slug);
    const at = c.rank ? ` at #${c.rank}${c.rank_max ? ` of ${c.rank_max}` : ""}` : "";
    items.push({
      q: `Is ${film.title} on the ${cname}?`,
      a: `Yes — ${film.title}${yearLabel} appears on the ${cname}${at}.`,
    });
  }
  // 5 — the count of wins.
  if (won.length > 0) {
    items.push({
      q: `How many awards has ${film.title} won?`,
      a: `By our count, ${film.title}${yearLabel} holds ${won.length} such honour${won.length === 1 ? "" : "s"} on record.`,
    });
  }
  return items.slice(0, 5);
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, lineage } = data;
  const year = film.year ? ` (${film.year})` : "";
  // No brand suffix — the root layout template appends "· Metatake".
  const title = `${film.title}${year} — Awards, Canons & Honors: the Complete Record`;
  const description = leadText(film, lineage);
  return {
    title,
    description,
    alternates: { canonical: `/film/lineage/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(lineage.length >= FILM_HONORS_MIN),
  };
}

function SourceTag({ meta }: { meta: LineageListMeta | undefined }) {
  if (!meta) return null;
  const src = lineageSource(meta.source);
  const wd = wikidataUrl(meta.external_ref);
  if (!src && !wd) return null;
  return (
    <span className="lin-meta" style={{ opacity: 0.65 }}>
      {" · via "}
      {wd ? <a href={wd} target="_blank" rel="noopener">{src?.name ?? "Wikidata"} ↗</a>
        : src?.url ? <a href={src.url} target="_blank" rel="noopener">{src.name} ↗</a>
        : src?.name}
    </span>
  );
}

export default async function FilmHonorsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, lineage, listMeta, hasLocationsPage } = data;
  const metaOf = (s: string) => (listMeta as Record<string, LineageListMeta>)[s];
  const { awards, canons, national, auteur } = splitRows(lineage);
  const updated = (await cachedLineageMeta()).updated || new Date().toISOString().slice(0, 10);
  const lead = leadText(film, lineage);
  const yearLabel = film.year ? ` (${film.year})` : "";

  // Same @id as the base film page's Movie node — the two must never
  // contradict (full ISO date + full sameAs on both; SEO_LINEAGE_SPEC §1b-2).
  const movieSameAs = [
    film.wikidata_id ? `https://www.wikidata.org/wiki/${film.wikidata_id}` : null,
    film.tmdb_id ? `https://www.themoviedb.org/movie/${film.tmdb_id}` : null,
    film.imdb_id ? `https://www.imdb.com/title/${film.imdb_id}/` : null,
  ].filter(Boolean);
  const movieLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": `https://metatake.net/film/${film.slug}`,
    url: `https://metatake.net/film/${film.slug}`,
    name: film.title,
    ...(film.release_date ? { datePublished: film.release_date } : film.year ? { datePublished: String(film.year) } : {}),
    ...(film.director ? { director: { "@type": "Person", name: film.director } } : {}),
    ...(film.poster_path ? { image: `${IMG}/w500${film.poster_path}` } : {}),
    ...(movieSameAs.length ? { sameAs: movieSameAs } : {}),
    ...(awards.filter((a) => a.result === "won").length
      ? { award: awards.filter((a) => a.result === "won").map(honorText) }
      : {}),
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${film.title}${yearLabel} — awards, canons and honors`,
    numberOfItems: lineage.length,
    itemListElement: [...awards, ...canons, ...national, ...auteur].map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${l.list_label}${l.result && l.result !== "listed" ? ` — ${l.result}` : ""}${l.edition_year ? ` (${l.edition_year})` : ""}${l.rank ? ` — ranked #${l.rank}` : ""}`,
      url: `https://metatake.net/lineage/${l.list_slug}`,
    })),
  };
  // Mirrors the visible trail, director crumb included.
  const hasDirCrumb = !!(film.director && film.director_slug);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Films", item: "https://metatake.net/film" },
      ...(hasDirCrumb ? [{ "@type": "ListItem", position: 3, name: film.director!, item: `https://metatake.net/director/${film.director_slug}` }] : []),
      { "@type": "ListItem", position: hasDirCrumb ? 4 : 3, name: `${film.title}${yearLabel}`, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: hasDirCrumb ? 5 : 4, name: "Awards & honors", item: `https://metatake.net/film/lineage/${film.slug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `https://metatake.net/film/lineage/${film.slug}`,
    name: `${film.title}${yearLabel} — awards, canons & honors`,
    about: { "@type": "Movie", "@id": `https://metatake.net/film/${film.slug}`, name: film.title },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    dateModified: updated,
  };

  const Row = ({ l, emblem }: { l: FilmLineageRow; emblem: string }) => (
    <div className="lin-row">
      <span className="lin-em" aria-hidden="true">{emblem}</span>
      {l.parent_label && l.parent_label !== l.list_label
        ? <><span className="lin-body">{l.parent_label}</span><span className="lin-sep">·</span></>
        : null}
      <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{awardLabel(l.list_label, l.list_slug)}</Link>
      {l.result && l.result !== "listed" ? <span className="lin-res"> · {l.result}</span> : null}
      {l.edition_year ? <span className="lin-meta"> · {l.edition_year}</span> : null}
      {l.rank ? <span className="lin-rank"> · #{l.rank}{l.rank_max ? ` of ${l.rank_max}` : ""}</span> : null}
      <SourceTag meta={metaOf(l.list_slug)} />
    </div>
  );

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(movieLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 880, padding: "28px 20px 60px" }}>
        <div className="df-crumb" style={{ marginBottom: 14 }}>
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="df-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
          <span className="df-sep">›</span><Link href={`/film/${film.slug}`}>{film.title}</Link>
          <span className="df-sep">›</span><span>Honors</span>
        </div>
        <EntityTVHero program={slug} reelSlugs={[slug]} label={film.title} backdrop={null} />

        <header style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 8 }}>
          {film.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Link href={`/film/${film.slug}`} style={{ flexShrink: 0 }}>
              <img src={`${IMG}/w185${film.poster_path}`} alt={`${film.title} poster`} width={110} height={165} style={{ borderRadius: 8, objectFit: "cover" }} loading="lazy" />
            </Link>
          ) : null}
          <div>
            <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>
              {film.title}{yearLabel} — awards, canons &amp; honors
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "64ch", margin: 0 }}>{lead}</p>
            <div className="lin-share" style={{ marginTop: 12 }}>
              <ShareDock variant="bar" path={`/film/lineage/${slug}`} title={`${film.title}${yearLabel} — awards, canons & honors`}
                hook={`${film.title}${yearLabel} — every award, canon and honors listing, the complete record on Metatake`}
                saveType="film-lineage" saveRef={slug} />
              <ShareDock variant="fab" path={`/film/lineage/${slug}`} title={`${film.title} — awards & honors`} noSave />
            </div>
          </div>
        </header>

        <QuickAnswers items={quickAnswerItems(film, lineage)} />

        {awards.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">Awards &amp; honours — {awards.length}</h2>
            <div className="lin-list">
              {awards.map((l, i) => <Row key={`a${i}`} l={l} emblem={awardBody(l.list_slug)?.emblem ?? "🏆"} />)}
            </div>
          </section>
        )}

        {canons.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">Canons &amp; rankings — {canons.length}</h2>
            <div className="lin-list">
              {canons.map((l, i) => <Row key={`c${i}`} l={l} emblem={canonEmblem(l.list_slug)} />)}
            </div>
          </section>
        )}

        {national.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">National canons — {national.length}</h2>
            <div className="lin-list">
              {national.map((l, i) => <Row key={`n${i}`} l={l} emblem="🏛️" />)}
            </div>
          </section>
        )}

        {auteur.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">Auteur line — {auteur.length}</h2>
            <div className="lin-list">
              {auteur.map((l, i) => <Row key={`u${i}`} l={l} emblem="🎬" />)}
            </div>
          </section>
        )}

        <section style={{ margin: "30px 0 0" }}>
          <h2 className="df-h2">Keep reading</h2>
          <p style={{ lineHeight: 1.9, margin: "6px 0 0" }}>
            <Link href={`/film/${film.slug}`}>{film.title} — the film page →</Link>
            {hasLocationsPage ? (
              <><br /><Link href={`/film/locations/${film.slug}`}>Where was {film.title} filmed? Every location, mapped →</Link></>
            ) : null}
            {film.director_slug ? (
              <><br /><Link href={`/director/${film.director_slug}`}>{film.director} — the director hub →</Link></>
            ) : null}
            <br /><Link href="/lineage">All lineages — awards, canons and national honours →</Link>
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Lineage record compiled from public sources — cited per entry · Data updated {updated} · Corrections: <Link href="/methodology">methodology</Link>
        </p>
      </div>
      <ReadPlates slug={film.slug} exclude="lineage" />
    </div>
  );
}
