import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
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
  async (): Promise<LinkDict> => {
    try {
      const { data } = await db().rpc("desk_link_dictionary");
      if (data && typeof data === "object") return data as LinkDict;
    } catch {
      /* enhancement only */
    }
    return { concepts: [], theorists: [] };
  },
  ["desk-link-dict-1"],
  { revalidate: 86400 }
);

async function loadUncached(slug: string, deskKey: string) {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, visible")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; slug: string; year: number | null; visible: boolean }>();
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

  const { data: modeRows } = await supabase
    .from("essays")
    .select("mode")
    .eq("film_id", film.id)
    .eq("lang", "ko")
    .eq("status", "verified");
  const koModes = new Set((modeRows ?? []).map((r) => r.mode));
  const otherDesks = DESK_KEYS.filter((k) => k !== desk.key && koModes.has(DESKS[k].mode));

  const dict = await loadDict();
  const html = linkifyEntities(essayMdToHtml(essay.body_md), dict);

  return {
    film: { title: film.title, slug: film.slug, year: film.year },
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
    ["desk-essay-ko-1", slug, deskKey],
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
      languages: { en: `/film/${slug}/${deskKey}`, ko: canonical },
    },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(true),
  };
}

export default async function DeskEssayKoPage({ params }: Props) {
  const { slug, desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) notFound();
  const data = await load(slug, deskKey);
  if (!data) notFound();
  const { film, essay, html, otherDesks } = data;
  const yearStr = film.year ? ` (${film.year})` : "";
  const label = KO_DESK_LABEL[desk.key] ?? desk.label;

  return (
    <div className="mt" lang="ko">
      <SiteNav />
      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 60px" }}>
        <div className="df-crumb">
          <Link href="/film">Films</Link>
          <span className="df-sep">›</span>
          <Link href={`/film/${film.slug}`}>{film.title}</Link>
          <span className="df-sep">›</span>
          <span>{label}</span>
        </div>

        <article className="essay">
          <div className="essay-kicker">
            <span className="essay-chip">{desk.deskName}</span>
            <span className="essay-meta">
              {essay.minutes}분 · 검증 {essay.date} ·{" "}
              <Link href={`/film/${film.slug}/${desk.key}`}>English</Link>
            </span>
          </div>

          <h1 className="essay-h1">{essay.title}</h1>
          {essay.dek && <p className="essay-dek">{essay.dek}</p>}

          {essay.spoiler >= 2 && (
            <p className="essay-spoiler">
              {film.title}
              {yearStr}의 결말을 포함한 전체 스포일러가 있습니다.
            </p>
          )}

          <div className="essay-body" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="essay-plaque">
            <p>
              <Link href="/engine-room">The Engine Room</Link>의 {desk.deskName}에서
              생산{essay.engine ? ` · 엔진: ${essay.engine}` : ""} · 사실검증 완료{" "}
              {essay.date} · <Link href="/methodology">방법론</Link>
            </p>
          </div>

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
    </div>
  );
}
