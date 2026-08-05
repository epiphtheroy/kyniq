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
import FigureLightbox from "@/components/FigureLightbox";
import { filmBackdropPaths, pickStills, injectFigures } from "@/lib/read-media";
import "@/app/curious/curious.css";
import "../../read.css";
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

const KO_DESK_LABEL: Record<string, string> = {
  theories: "팬 이론",
  decoder: "디코더",
  debates: "비평 논쟁",
  contested: "쟁점 독해",
  "reception-story": "수용사",
  "parallel-lives": "평행한 삶",
  "field-test": "필드 테스트",
  exegesis: "주해",
};

const loadDict = unstable_cache(
  async (): Promise<LinkDict> => loadFullLinkDict(db() as never),
  ["desk-link-dict-6"],
  { revalidate: 86400 }
);

async function loadUncached(slug: string, deskKey: string) {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, title_ko, slug, year, visible, backdrop_path, poster_path, tmdb_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; title_ko: string | null; slug: string; year: number | null; visible: boolean; backdrop_path: string | null; poster_path: string | null; tmdb_id: number | null }>();
  if (!film || !film.visible) return null;

  const { data: essay } = await supabase
    .from("essays")
    .select("slug, title, dek, body_md, spoiler_level, engine, published_at, created_at")
    .eq("film_id", film.id)
    .eq("mode", desk.mode)
    .eq("lang", "ko")
    .eq("status", "verified")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{
      slug: string;
      title: string;
      dek: string | null;
      body_md: string;
      spoiler_level: number | null;
      engine: string | null;
      published_at: string | null;
      created_at: string;
    }>();
  if (!essay || !essay.body_md) return null;

  const [{ data: modeRows }, { data: vidRows }] = await Promise.all([
    supabase
      .from("essays")
      .select("mode")
      .eq("film_id", film.id)
      .eq("lang", "ko")
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
  const koModes = new Set((modeRows ?? []).map((r) => r.mode));
  const otherDesks = DESK_KEYS.filter((k) => k !== desk.key && koModes.has(DESKS[k].mode));

  const dict = await loadDict();
  const html = linkifyEntities(essayMdToHtml(essay.body_md), dict);

  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));

  return {
    // /ko essay page — show the Korean film title everywhere it renders (header,
    // "other desks", metadata). Falls back to English when title_ko is absent.
    film: { title: film.title_ko ?? film.title, slug: film.slug, year: film.year, backdrop_path: film.backdrop_path, poster_path: film.poster_path, tmdb_id: film.tmdb_id },
    videos,
    essay: {
      title: mdToPlain(essay.title),
      dek: essay.dek ? mdToPlain(essay.dek) : null,
      spoiler: essay.spoiler_level ?? 0,
      engine: essay.engine,
      date: (essay.published_at ?? essay.created_at).slice(0, 10),
      minutes: readingMinutes(essay.body_md),
    },
    html,
    otherDesks,
  };
}

function load(slug: string, deskKey: string) {
  return unstable_cache(
    () => loadUncached(slug, deskKey),
    // v5: payload gained film art/tmdb_id + hero videos (2026-07-08 redesign)
    ["desk-essay-ko-6", slug, deskKey],
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
  const label = KO_DESK_LABEL[desk.key] ?? desk.label;
  const yearStr = data.film.year ? ` (${data.film.year})` : "";
  const title = `${data.film.title}${yearStr} ${label} — 해설과 검증`;
  const description = metaDescription(data.essay.dek, `${data.film.title} ${label}.`);
  const canonical = `/film/${slug}/${deskKey}/ko`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { en: `/film/${slug}/${deskKey}`, ko: canonical, "x-default": `/film/${slug}/${deskKey}` },
    },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    // Same essay-length bar as the EN desk page — thin readings noindex (prune to grow).
    robots: pageRobots(data.essay.minutes >= 3),
  };
}

export default async function DeskEssayKoPage({ params }: Props) {
  const { slug, desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) notFound();
  const data = await load(slug, deskKey);
  if (!data) notFound();
  const { film, essay, html, otherDesks, videos } = data;
  const yearStr = film.year ? ` (${film.year})` : "";
  const label = KO_DESK_LABEL[desk.key] ?? desk.label;

  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:${desk.key}:ko`, 6);
  const bodyHtml = injectFigures(html, artPicks.slice(0, 3), `${film.title}${yearStr}`);
  const plateArt = [...artPicks.slice(3), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  return (
    <div className="mt" lang="ko">
      <SiteNav />
      <ReadHero
        film={film}
        sharePath={`/film/${film.slug}/${desk.key}/ko`}
        shareTitle={essay.title}
        shareHook={essay.dek ?? undefined}
        crumbTail={label}
        chip={<><Link href="/curious" style={{ color: "inherit", textDecoration: "none" }}>Curious</Link>{" · "}{desk.deskName}</>}
        meta={<>{essay.minutes}분 · 검증 {essay.date} ·{" "}<Link href={`/film/${film.slug}/${desk.key}`} style={{ color: "inherit", textDecoration: "underline" }}>English</Link></>}
        title={essay.title}
        dek={essay.dek ?? undefined}
        videos={videos}
        backdropPath={film.backdrop_path}
        tmdbId={film.tmdb_id}
      />
      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline created={essay.date} />

          {essay.spoiler >= 2 && (
            <p className="essay-spoiler">
              {film.title}
              {yearStr}의 결말을 포함한 전체 스포일러가 있습니다.
            </p>
          )}

          <div className="essay-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          <FigureLightbox scope=".essay-body" />

          <div className="essay-plaque">
            <p>
              <Link href="/engine-room">The Engine Room</Link>의 {desk.deskName}에서
              생산{essay.engine ? ` · 엔진: ${essay.engine}` : ""} · 사실검증 완료{" "}
              {essay.date}
            </p>
          </div>
          <Provenance created={essay.date} />

          {otherDesks.length > 0 && (
            <section style={{ margin: "28px 0 0" }}>
              <h2 className="df-h2">{film.title}의 다른 데스크</h2>
              <ul className="essay-desklist">
                {otherDesks.map((k) => (
                  <li key={k}>
                    <Link href={`/film/${film.slug}/${k}/ko`}>
                      {KO_DESK_LABEL[k] ?? DESKS[k].label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p style={{ marginTop: 24 }}>
            <Link href={`/film/${film.slug}`}>
              ← {film.title}
              {yearStr} 전체 보기
            </Link>
          </p>
        </article>
      </div>

      <ReadPlates slug={film.slug} exclude={`desk:${desk.key}`} artPaths={plateArt} />
    </div>
  );
}
