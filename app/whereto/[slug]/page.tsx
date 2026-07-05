import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import AccessCountryProvider from "@/components/AccessCountryProvider";
import WatchPageClient, { type WatchFilm, type WatchData, type WatchRatings } from "@/components/WatchPageClient";
import type { AccessRecord } from "@/components/AccessEnrichment";
import accessEnrichment from "@/lib/access_enrichment.json";
import { resolveAlias } from "@/lib/aliases";
import { pageRobots } from "@/lib/seo";

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
type QLink = { slug: string; title: string; display_title: string | null; title_spoiler: boolean | null };

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, runtime, poster_path, imdb_id, tmdb_id, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  const [{ data: wpRow }, { data: ratRow }, { data: codex }, { data: figRows }, { data: qRows }] = await Promise.all([
    supabase.from("film_watch_providers").select("results, countries").eq("film_id", film.id).maybeSingle(),
    supabase.from("film_ratings").select("imdb_rating, imdb_votes, metascore, rt_tomatometer").eq("film_id", film.id).maybeSingle(),
    supabase.rpc("cinecodex_for", { p_slug: slug }),
    supabase.from("figures").select("slug, label").eq("film_id", film.id).eq("status", "approved").not("slug", "is", null).limit(6),
    supabase.from("questions").select("slug, title, display_title, title_spoiler").eq("film_id", film.id).eq("status", "published").order("published_at", { ascending: false }).limit(3),
  ]);
  const cx = codex as { v: number; c: number; r: number } | null;
  return {
    film: film as WatchFilm & { id: string; visible: boolean | null },
    watch: (wpRow as WatchData) ?? null,
    ratings: (ratRow as WatchRatings) ?? null,
    takeScore: cx ? Math.round(cx.v - cx.r) : null,
    record: accessRecordFor((film as { tmdb_id: number | null }).tmdb_id),
    figures: (figRows ?? []) as FigLink[],
    questions: (qRows ?? []) as QLink[],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film } = data;
  const title = `Where to watch ${film.title}${film.year ? ` (${film.year})` : ""} — streaming, free archives, disc & subtitles · Metatake`;
  const description = `Every legal way to watch ${film.title}${film.year ? ` (${film.year})` : ""} — streaming, rent and buy by country (via JustWatch & TMDB), plus MetaTake-verified free archives, MUBI country differences, disc editions and subtitle links.`;
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
  const { film, watch, record, ratings, takeScore, figures, questions } = data;
  const titleYear = `${film.title}${film.year ? ` (${film.year})` : ""}`;
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
      <AccessCountryProvider>
        <WatchPageClient film={film} watch={watch} record={record} ratings={ratings} takeScore={takeScore} />
      </AccessCountryProvider>

      {/* Server-rendered corpus links — the crawlable HTML under the client watch UI. */}
      <div className="axw-wrap">
        <section className="axw-section">
          <h2 className="axw-h2">Read closely on Metatake</h2>
          <div className="axw-h2s">Once you know where to watch {titleYear} — what it means. Figures, Q&amp;A and close readings behind the film.</div>
          <div className="rcp-list">
            <div className="rcp-row">
              <a className="rcp-h" href={`/film/${film.slug}`}>{titleYear} — the film page</a>
              <div className="rcp-m">Strong Misreadings, figures and the codex</div>
            </div>
            <div className="rcp-row">
              <a className="rcp-h" href={`/movies-like/${film.slug}`}>Movies like {film.title}</a>
              <div className="rcp-m">What to watch next</div>
            </div>
            {figures.map((f) => (
              <div className="rcp-row" key={f.slug}>
                <a className="rcp-h" href={`/film/${film.slug}/figure/${f.slug}`}>{f.label}</a>
                <div className="rcp-m">Figure · {film.title}</div>
              </div>
            ))}
            {questions.map((q) => (
              <div className="rcp-row" key={q.slug}>
                <a className="rcp-h" href={`/film/${film.slug}/q/${q.slug}`}>{q.title_spoiler && q.display_title ? q.display_title : q.title}</a>
                <div className="rcp-m">Q&amp;A · {film.title}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
