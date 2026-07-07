import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";
import {
  DESKS,
  DESK_KEYS,
  deskByKey,
  essayMdToHtml,
  linkifyEntities,
  mdToPlain,
  metaDescription,
  readingMinutes,
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
  async (): Promise<LinkDict> => {
    try {
      const { data } = await db().rpc("desk_link_dictionary");
      if (data && typeof data === "object") return data as LinkDict;
    } catch {
      /* dictionary is an enhancement, never a blocker */
    }
    return { concepts: [], theorists: [] };
  },
  ["desk-link-dict-2"],
  { revalidate: 86400 }
);

async function loadUncached(slug: string, deskKey: string, lang: "en" | "ko") {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, visible")
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
  const { data: modeRows } = await supabase
    .from("essays")
    .select("mode, lang")
    .eq("film_id", film.id)
    .eq("status", "verified");
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

  return {
    film: {
      id: film.id,
      title: film.title,
      slug: film.slug,
      year: film.year,
      director: film.director,
      director_slug: film.director_slug,
    },
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
    ["desk-essay-2", slug, deskKey, lang],
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
  const { film, essay, html, otherDesks, hasKo } = data;
  const yearStr = film.year ? ` (${film.year})` : "";

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
      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 60px" }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

        <div className="df-crumb">
          <Link href="/film">Films</Link>
          <span className="df-sep">›</span>
          <Link href={`/film/${film.slug}`}>{film.title}</Link>
          <span className="df-sep">›</span>
          <span>{desk.label}</span>
        </div>

        <article className="essay">
          <div className="essay-kicker">
            <span className="essay-chip">
              <Link href="/blog/curious" style={{ color: "inherit", textDecoration: "none" }}>
                Curious
              </Link>
              {" · "}
              {desk.deskName}
            </span>
            <span className="essay-meta">
              {essay.minutes} min read · verified {essay.date}
              {hasKo && (
                <>
                  {" · "}
                  <Link href={`/film/${film.slug}/${desk.key}/ko`}>한국어</Link>
                </>
              )}
            </span>
          </div>

          <h1 className="essay-h1">{essay.title}</h1>
          <Byline created={essay.date} />
          {essay.dek && <p className="essay-dek">{essay.dek}</p>}

          {essay.spoiler >= 2 && (
            <p className="essay-spoiler">
              Full spoilers for {film.title}
              {yearStr} throughout — including the ending.
            </p>
          )}

          <div className="essay-body" dangerouslySetInnerHTML={{ __html: html }} />

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
    </div>
  );
}
