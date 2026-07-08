import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/reception — "What Critics Said About {Director}'s Films"
 * (2026-07-09): the filmography's critical record as one article. LLM-0
 * assembly from film_reception across every visible film — headlines and the
 * publishers' own link-preview paragraphs (dek_lead) plus paper abstracts,
 * never article text. Copyright discipline copied from the film-level
 * reception page: quotes are verbatim link previews/abstracts, every item
 * links out to its source (target=_blank rel="noopener nofollow"). The old
 * `year` column is the FILM year — review dates come from review_year only.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Rcp = {
  film_id: string; kind: string; outlet: string; critic: string | null;
  tier: string | null; headline: string; verdict: string | null;
  dek_lead: string | null; review_year: number | null; url: string;
};
type Film = { id: string; slug: string; title: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null };

async function loadUncached(slug: string) {
  const supabase = db();
  const [{ data: films }, { data: dir }] = await Promise.all([
    supabase.from("films")
      .select("id, slug, title, year, director, backdrop_path, poster_path")
      .eq("director_slug", slug).eq("visible", true).order("year"),
    supabase.from("directors").select("name").eq("slug", slug).maybeSingle(),
  ]);
  if (!films || films.length === 0) return null;
  const filmArr = films as Film[];
  const filmIds = filmArr.map((f) => f.id);
  const director = (dir?.name as string | undefined) || filmArr[0].director || slug.replace(/-/g, " ");

  // The whole filmography's reception rows in one batched query. PostgREST
  // caps every response at 1000 rows — page with .range until a short chunk.
  const PAGE = 1000;
  let rows: Rcp[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("film_reception")
      .select("film_id, kind, outlet, critic, tier, headline, verdict, dek_lead, review_year, url")
      .in("film_id", filmIds)
      .order("film_id").order("position")
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as Rcp[];
    rows = rows.concat(chunk);
    if (chunk.length < PAGE) break;
  }
  if (rows.length === 0) return null;

  // Sideways-door head counts. Honors gate = the honors page's own render
  // condition (lineage rows + Wikidata rows ≥ 1) — the per-film lineage RPC
  // is too heavy for a gate, the film_lineage table head count matches it.
  const [wd, ln] = await Promise.all([
    supabase.from("film_wd_honors").select("id", { count: "exact", head: true }).in("film_id", filmIds),
    supabase.from("film_lineage").select("id", { count: "exact", head: true }).in("film_id", filmIds),
  ]);

  const native = await directorNative(director);

  return {
    director, native,
    films: filmArr,
    rows,
    honorsCount: (wd.count ?? 0) + (ln.count ?? 0),
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-reception-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

type Data = NonNullable<Awaited<ReturnType<typeof loadUncached>>>;

function statsOf(d: Data) {
  const reviews = d.rows.filter((r) => r.kind === "criticism");
  const papers = d.rows.filter((r) => r.kind === "academic");
  const outlets = [...new Set(reviews.map((r) => r.outlet))];
  const venues = [...new Set(papers.map((r) => r.outlet))];
  const covered = new Set(d.rows.map((r) => r.film_id)).size;
  const ys = d.rows.map((r) => r.review_year ?? 0).filter((y) => y > 1880);
  const y0 = ys.length ? Math.min(...ys) : null;
  const y1 = ys.length ? Math.max(...ys) : null;
  // Most-cited outlets, reviews first (papers only when no criticism exists).
  const counts = new Map<string, number>();
  for (const r of reviews.length ? reviews : papers) counts.set(r.outlet, (counts.get(r.outlet) ?? 0) + 1);
  const topOutlets = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([o]) => o);
  return { reviews, papers, outlets, venues, covered, y0, y1, topOutlets };
}

function pageTitle(d: Data): string {
  const { reviews, papers, outlets } = statsOf(d);
  const bits = [
    reviews.length ? `${reviews.length} Review${reviews.length === 1 ? "" : "s"}` : null,
    reviews.length ? `${outlets.length} Outlet${outlets.length === 1 ? "" : "s"}` : null,
    papers.length ? `${papers.length} Paper${papers.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
  return `What Critics Said About ${d.director}'s Films${bits ? ` — ${bits}` : ""}`;
}

function pageDescription(d: Data): string {
  const { reviews, papers, topOutlets } = statsOf(d);
  const named = topOutlets.slice(0, 3).join(", ");
  let description = reviews.length
    ? `What critics said about ${d.director}'s films — ${reviews.length} review${reviews.length === 1 ? "" : "s"} from ${named}${topOutlets.length > 3 ? " and more" : ""}${papers.length ? `, plus ${papers.length} scholarly paper${papers.length === 1 ? "" : "s"}` : ""}, film by film. Every item links to its source.`
    : `The scholarly record on ${d.director}'s films — ${papers.length} paper${papers.length === 1 ? "" : "s"} from ${named}${topOutlets.length > 3 ? " and more" : ""}, film by film. Every item links to its source.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return description;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = pageTitle(data);
  const description = pageDescription(data);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/reception` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.rows.length >= 3),
  };
}

const hasQuote = (r: Rcp) => !!(r.dek_lead || r.verdict);

export default async function DirectorReceptionPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, native, films, rows, honorsCount } = data;
  const { reviews, papers, outlets, venues, covered, y0, y1, topOutlets } = statsOf(data);
  const span = y0 && y1 ? (y0 === y1 ? `${y0}` : `${y0}–${y1}`) : null;

  const filmById = new Map(films.map((f) => [f.id, f]));
  const rowsByFilm = new Map<string, Rcp[]>();
  for (const r of rows) rowsByFilm.set(r.film_id, [...(rowsByFilm.get(r.film_id) ?? []), r]);
  // Films with a record, in the query's year order (nulls last).
  const coveredFilms = films.filter((f) => rowsByFilm.has(f.id));

  // Hero backdrop: the film with the most reception rows that has art.
  const byCount = coveredFilms.slice().sort((a, b) => rowsByFilm.get(b.id)!.length - rowsByFilm.get(a.id)!.length);
  const bdFilm = byCount.find((f) => f.backdrop_path) ?? films.find((f) => f.backdrop_path) ?? null;

  // The pull-quote lead: the 2 best dek_lead quotes across the filmography —
  // verdict-tier first, then criticism before papers, stored order breaks
  // ties; distinct outlets and distinct films. Deterministic (stable sort).
  const leadCandidates = rows
    .filter((r) => r.dek_lead && filmById.has(r.film_id))
    .slice()
    .sort((a, b) =>
      (a.tier === "verdict" ? 0 : 1) - (b.tier === "verdict" ? 0 : 1) ||
      (a.kind === "criticism" ? 0 : 1) - (b.kind === "criticism" ? 0 : 1)
    );
  const leads: { r: Rcp; film: Film }[] = [];
  const usedOutlets = new Set<string>();
  const usedFilms = new Set<string>();
  for (const r of leadCandidates) {
    if (usedOutlets.has(r.outlet) || usedFilms.has(r.film_id)) continue;
    leads.push({ r, film: filmById.get(r.film_id)! });
    usedOutlets.add(r.outlet); usedFilms.add(r.film_id);
    if (leads.length === 2) break;
  }
  const leadSet = new Set(leads.map((l) => l.r));

  // Per-film row order: the best quotable item first (not one already quoted
  // in the lead), then verdict-tier, then the stored (position) order.
  const orderItems = (items: Rcp[]): Rcp[] => {
    const idx = new Map(items.map((r, i) => [r, i] as const));
    return items.slice().sort((a, b) =>
      ((hasQuote(a) && !leadSet.has(a)) ? 0 : 1) - ((hasQuote(b) && !leadSet.has(b)) ? 0 : 1) ||
      (a.tier === "verdict" ? 0 : 1) - (b.tier === "verdict" ? 0 : 1) ||
      idx.get(a)! - idx.get(b)!
    );
  };

  const title = pageTitle(data);
  const description = pageDescription(data);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Reception", item: `https://metatake.net/director/${slug}/reception` },
    ],
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/director/${slug}/reception`,
    headline: title,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name: director, ...(native ? { alternateName: native } : {}), url: `https://metatake.net/director/${slug}` },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake", url: "https://metatake.net" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };

  // One compact row per item — headline links out, meta line beneath; the
  // first row of a film also carries its quote (dek_lead, else verdict).
  const Row = ({ r, quoted }: { r: Rcp; quoted: boolean }) => (
    <section className="afl-item">
      <h3 className="afl-h3">
        <a href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
      </h3>
      <p className="afl-src">
        {r.kind === "academic" ? "Paper · " : ""}
        {r.outlet}
        {r.critic ? ` · ${r.critic}` : ""}
        {r.review_year ? ` · ${r.review_year}` : ""}
      </p>
      {quoted && hasQuote(r) ? <p className="afl-q">“{r.dek_lead || r.verdict}”</p> : null}
    </section>
  );

  const heroMeta = [
    reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} · ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}` : null,
    papers.length ? `${papers.length} paper${papers.length === 1 ? "" : "s"}` : null,
    `${covered} film${covered === 1 ? "" : "s"}`,
    span,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* ── Dark hero: the critical record, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{director}</Link><span>›</span>
              <span>Reception</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">Reception · the filmography</span>
              <span className="rd-meta">{heroMeta}</span>
            </div>
            <h1 className="rd-h1">
              What Critics Said About {director}&apos;s Films
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
            </h1>
            <p className="rd-dek">
              {topOutlets.length ? (
                <>What {topOutlets.slice(0, 3).join(", ")}{topOutlets.length > 3 ? " and more" : ""} said about {director}&apos;s films</>
              ) : (
                <>The critical record on {director}&apos;s films</>
              )}
              {span ? <>, {span}</> : null}
              {" — "}headlines and the publishers&apos; own link previews, film by film. Every item links to its source.
            </p>
          </div>
          {bdFilm?.backdrop_path ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${bdFilm.backdrop_path}`} alt="" width={780} height={439} />
              <div className="rd-hero__cap">From {bdFilm.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            <div className="lin-stats">
              {reviews.length ? (
                <span className="lin-stat" style={{ "--sc": "#D64534" } as CSSProperties}>
                  🗞 {reviews.length} review{reviews.length === 1 ? "" : "s"} · {outlets.length} outlet{outlets.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {papers.length ? (
                <span className="lin-stat" style={{ "--sc": "#12897A" } as CSSProperties}>
                  🎓 {papers.length} paper{papers.length === 1 ? "" : "s"} · {venues.length} venue{venues.length === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="lin-stat" style={{ "--sc": "#B8863B" } as CSSProperties}>
                {covered} of {films.length} film{films.length === 1 ? "" : "s"} covered
              </span>
              {span ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as CSSProperties}>{span}</span> : null}
            </div>

            {leads.map((l, i) => (
              <div key={i}>
                <blockquote className="afl-q">“{l.r.dek_lead}”</blockquote>
                <p className="lin-qsrc">
                  — {l.r.critic ? `${l.r.critic}, ` : ""}
                  <a href={l.r.url} target="_blank" rel="noopener nofollow">{l.r.outlet}</a>
                  {l.r.review_year ? ` (${l.r.review_year})` : ""}, on{" "}
                  <Link href={`/film/${l.film.slug}`}>{l.film.title}</Link>
                </p>
              </div>
            ))}

            <p>
              Across {director}&apos;s {films.length} film{films.length === 1 ? "" : "s"} on Metatake, the critical
              record runs to{" "}
              {[
                reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}` : null,
                papers.length ? `${papers.length} scholarly paper${papers.length === 1 ? "" : "s"}` : null,
              ].filter(Boolean).join(" and ")}
              {span ? `, ${span}` : ""}. Below is that record, film by film in the order the work was made.
              Quotes are verbatim from the publishers&apos; link previews and paper abstracts; no article text is
              stored, and every headline links out to its source.
            </p>

            {coveredFilms.map((f, i) => {
              const items = orderItems(rowsByFilm.get(f.id)!);
              const head = items.slice(0, 5);
              const tail = items.slice(5);
              const tailOutlets = [...new Set(tail.map((r) => r.outlet))].slice(0, 3).join(" · ");
              // Mid-article stills: every third film section carries that
              // film's own backdrop — deterministic, captioned, never the
              // hero's art again.
              const still = i > 0 && i % 3 === 0 && f.backdrop_path && f.id !== bdFilm?.id ? f.backdrop_path : null;
              return (
                <section key={f.slug} id={`f-${f.slug}`}>
                  {still ? (
                    <figure className="rd-fig">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/w780${still}`} alt={`${f.title} still`} loading="lazy" width={780} height={439} />
                      <figcaption>{f.title}{f.year ? ` (${f.year})` : ""} · via TMDB</figcaption>
                    </figure>
                  ) : null}
                  <h2>{f.title}{f.year ? ` (${f.year})` : ""}</h2>
                  {head.map((r, j) => <Row key={j} r={r} quoted={j === 0} />)}
                  {tail.length ? (
                    <details className="vl-d">
                      <summary>
                        <span className="vl-sum-d">More on {f.title}</span>
                        <span className="vl-n">{tail.length}</span>
                        <span className="vl-sum-kw">{tailOutlets}</span>
                      </summary>
                      <div style={{ padding: "4px 16px 12px" }}>
                        {tail.map((r, j) => <Row key={j} r={r} quoted={false} />)}
                      </div>
                    </details>
                  ) : null}
                  <p style={{ fontSize: "0.92em" }}>
                    <Link href={`/film/${f.slug}/reception`}>{f.title} — the full year-by-year timeline →</Link>
                  </p>
                </section>
              );
            })}

            <hr />
            <p>
              Sources: the publishers&apos; own headlines and link previews (og:description), and paper abstracts
              via OpenAlex/Crossref. Quotes are verbatim; no article text is stored, and every item links out to
              its source. Each film&apos;s full afterlife — releases, honors and revivals, year by year — lives on
              its own reception page, linked above.
            </p>

            {honorsCount >= 1 || films.length >= 3 ? (
              <div className="rec-tocs">
                {honorsCount >= 1 ? (
                  <RecordToc
                    href={`/director/${slug}/honors`}
                    kicker="The record"
                    title={`Every award ${director}'s films have won — counted and sourced`}
                    rows={[
                      { label: "Honors on record", value: honorsCount },
                      { label: "Films", value: films.length },
                    ]}
                    cta="Open the record"
                  />
                ) : null}
                {films.length >= 3 ? (
                  <RecordToc
                    href={`/director/${slug}/takescore`}
                    kicker="TakeScore"
                    title={`Every ${director} film, scored — the TakeScore ranking`}
                    rows={[
                      { label: "Films", value: films.length },
                      { label: "Reviews on record", value: rows.length },
                    ]}
                    cta="Open the ranking"
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

      <DirectorPlates slug={slug} exclude="reception" />
    </div>
  );
}
