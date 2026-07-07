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
import { filmBackdropPaths, pickStills, injectFigures } from "@/lib/read-media";
import { pageRobots } from "@/lib/seo";
import "@/app/curious/curious.css";
import "../read.css";
import {
  DESKS,
  DESK_KEYS,
  deskByKey,
  essayMdToHtml,
  linkifyEntities,
  mdToPlain,
  metaDescription,
  readingMinutes,
  loadFullLinkDict,
  type LinkDict,
} from "@/lib/desks";

export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type FilmRow = {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  director: string | null;
  director_slug: string | null;
  visible: boolean;
  backdrop_path: string | null;
  poster_path: string | null;
  tmdb_id: number | null;
};

type EssayRow = {
  slug: string;
  title: string;
  dek: string | null;
  body_md: string;
  spoiler_level: number | null;
  engine: string | null;
  prompt_version: string | null;
  published_at: string | null;
  created_at: string;
};

const loadDict = unstable_cache(
  async (): Promise<LinkDict> => loadFullLinkDict(db() as never),
  ["desk-link-dict-4"],
  { revalidate: 86400 }
);

async function loadUncached(slug: string, deskKey: string, lang: "en" | "ko") {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, visible, backdrop_path, poster_path, tmdb_id")
    .eq("slug", slug)
    .maybeSingle<FilmRow>();
  if (!film || !film.visible) return null;

  const { data: essay } = await supabase
    .from("essays")
    .select(
      "slug, title, dek, body_md, spoiler_level, engine, prompt_version, published_at, created_at"
    )
    .eq("film_id", film.id)
    .eq("mode", desk.mode)
    .eq("lang", lang)
    .eq("status", "verified")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<EssayRow>();
  if (!essay || !essay.body_md) return null;

  // which other desks exist for this film (verified EN) + whether KO pair exists
  const [{ data: modeRows }, { data: vidRows }] = await Promise.all([
    supabase
      .from("essays")
      .select("mode, lang")
      .eq("film_id", film.id)
      .eq("status", "verified"),
    supabase
      .from("media")
      .select("kind, external_id, title")
      .eq("entity_type", "film")
      .eq("entity_id", film.id)
      .eq("status", "published")
      .eq("kind", "video")
      .order("position"),
  ]);
  const enModes = new Set<string>();
  let hasKo = false;
  for (const r of modeRows ?? []) {
    if (r.lang === "en") enModes.add(r.mode);
    if (r.lang === "ko" && r.mode === desk.mode) hasKo = true;
  }
  const otherDesks = DESK_KEYS.filter(
    (k) => k !== desk.key && enModes.has(DESKS[k].mode)
  );

  const dict = await loadDict();
  const html = linkifyEntities(essayMdToHtml(essay.body_md), dict);

  // Hero reel: clips first, trailer/teaser last (same order as the film page).
  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[])
    .filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));

  return {
    film: {
      id: film.id,
      title: film.title,
      slug: film.slug,
      year: film.year,
      director: film.director,
      director_slug: film.director_slug,
      backdrop_path: film.backdrop_path,
      poster_path: film.poster_path,
      tmdb_id: film.tmdb_id,
    },
    videos,
    essay: {
      slug: essay.slug,
      title: mdToPlain(essay.title),
      dek: essay.dek ? mdToPlain(essay.dek) : null,
      spoiler: essay.spoiler_level ?? 0,
      engine: essay.engine,
      promptVersion: essay.prompt_version,
      date: (essay.published_at ?? essay.created_at).slice(0, 10),
      minutes: readingMinutes(essay.body_md),
    },
    html,
    otherDesks,
    hasKo,
  };
}

function load(slug: string, deskKey: string, lang: "en" | "ko" = "en") {
  return unstable_cache(
    () => loadUncached(slug, deskKey, lang),
    // v5: payload gained film art/tmdb_id + hero videos (2026-07-08 redesign)
    ["desk-essay-5", slug, deskKey, lang],
    { revalidate: 3600, tags: [`film:${slug}`] }
  )();
}

type Props = { params: Promise<{ slug: string; desk: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) return { title: "Not found" };
  const data = await load(slug, deskKey);
  if (!data) return { title: "Not found" };
  const title = desk.metaTitle(data.film.title, data.film.year);
  const description = metaDescription(
    data.essay.dek,
    `${desk.blurb} ${data.film.title}${data.film.year ? ` (${data.film.year})` : ""}.`
  );
  const canonical = `/film/${slug}/${deskKey}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      ...(data.hasKo
        ? { languages: { en: canonical, ko: `${canonical}/ko` } }
        : {}),
    },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(true),
  };
}

export default async function DeskEssayPage({ params }: Props) {
  const { slug, desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) notFound();
  const data = await load(slug, deskKey);
  if (!data) notFound();
  const { film, essay, html, otherDesks, hasKo, videos } = data;
  const yearStr = film.year ? ` (${film.year})` : "";

  // TMDB gallery stills: 3 into the article (ScreenRant-style), the rest vary
  // the bottom plates. Deterministic per film+desk (stable across renders).
  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:${desk.key}`, 6);
  const bodyHtml = injectFigures(html, artPicks.slice(0, 3), `${film.title}${yearStr}`);
  const plateArt = [...artPicks.slice(3), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/film/${film.slug}/${desk.key}`,
    headline: desk.metaTitle(film.title, film.year),
    description: essay.dek ?? undefined,
    datePublished: essay.date,
    inLanguage: "en",
    about: { "@id": `https://metatake.net/film/${film.slug}` },
    isPartOf: {
      "@type": "WebSite",
      name: "Metatake",
      url: "https://metatake.net",
    },
    publisher: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Films", item: "https://metatake.net/film" },
      { "@type": "ListItem", position: 2, name: `${film.title}${yearStr}`, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: 3, name: desk.label, item: `https://metatake.net/film/${film.slug}/${desk.key}` },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <ReadHero
        film={film}
        crumbTail={desk.label}
        chip={<><Link href="/curious" style={{ color: "inherit", textDecoration: "none" }}>Curious</Link>{" · "}{desk.deskName}</>}
        meta={<>{essay.minutes} min read · verified {essay.date}{hasKo && <>{" · "}<Link href={`/film/${film.slug}/${desk.key}/ko`} style={{ color: "inherit", textDecoration: "underline" }}>한국어</Link></>}</>}
        title={essay.title}
        dek={essay.dek ?? undefined}
        videos={videos}
        backdropPath={film.backdrop_path}
      />

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline created={essay.date} />

          {essay.spoiler >= 2 && (
            <p className="essay-spoiler">
              Full spoilers for {film.title}
              {yearStr} throughout — including the ending.
            </p>
          )}

          <div className="essay-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          <div className="essay-plaque">
            <p>
              Produced at {desk.deskName} of{" "}
              <Link href="/engine-room">The Engine Room</Link>
              {essay.engine ? ` · engine: ${essay.engine}` : ""} · fact-checked and
              verified {essay.date}
            </p>
          </div>
          <Provenance created={essay.date} />

          {otherDesks.length > 0 && (
            <section style={{ margin: "28px 0 0" }}>
              <h2 className="df-h2">More desks on {film.title}</h2>
              <ul className="essay-desklist">
                {otherDesks.map((k) => (
                  <li key={k}>
                    <Link href={`/film/${film.slug}/${k}`}>
                      {DESKS[k].label} — {DESKS[k].blurb}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p style={{ marginTop: 24 }}>
            <Link href={`/film/${film.slug}`}>
              ← Everything on {film.title}
              {yearStr}
            </Link>
          </p>
        </article>
      </div>

      <ReadPlates slug={film.slug} exclude={`desk:${desk.key}`} artPaths={plateArt} />
    </div>
  );
}
