import { createClient } from "@supabase/supabase-js";
import EntityTVHero from "@/components/EntityTVHero";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { pageRobots } from "@/lib/seo";
import { deskByKey, mdToPlain } from "@/lib/desks";
import { Card, SectionHead, monDate, type FilmArt } from "@/components/curious/ui";

/**
 * Curious desk index — ScreenRant-style category page (2026-07-07 redesign):
 * latest essays as a card grid, then the full crawlable A–Z list grouped by
 * film. Canonical reading pages live at /film/[slug]/[desk]. Moved from
 * /blog/curious/[desk] 2026-07-07 (the old path 308s here).
 */
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type ERow = {
  title: string; dek: string | null; spoiler_level: number | null;
  published_at: string | null; created_at: string;
  film: FilmArt;
};

async function loadUncached(deskKey: string) {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const rows: ERow[] = [];
  for (let from = 0; from < 8000; from += 1000) {
    const { data } = await supabase
      .from("essays")
      .select("title, dek, spoiler_level, published_at, created_at, film:films!inner(slug, title, year, poster_path, backdrop_path, visible)")
      .eq("mode", desk.mode)
      .eq("lang", "en")
      .eq("status", "verified")
      .eq("film.visible", true)
      .order("film_id", { ascending: true })
      .range(from, from + 999);
    const batch = (data ?? []) as unknown as ERow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  if (rows.length === 0) return null;
  // Card grid wants newest-first; the index below wants A–Z by film.
  const latest = [...rows]
    .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
    .slice(0, 10);
  rows.sort((a, b) => (a.film.title || "").localeCompare(b.film.title || ""));
  return { rows, latest };
}

// v2: payload gained film art + latest slice (bump the key, never reuse).
function load(deskKey: string) {
  return unstable_cache(() => loadUncached(deskKey), ["curious-desk-2", deskKey], {
    revalidate: 3600,
  })();
}

type Props = { params: Promise<{ desk: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) return { title: "Not found" };
  const data = await load(deskKey);
  const n = data?.rows.length ?? 0;
  const title = `${desk.label} — ${desk.deskName} · Curious`;
  const description = `${desk.blurb} ${n.toLocaleString()} films and counting — every essay fact-checked and verified.`;
  return {
    title,
    description,
    alternates: { canonical: `/curious/${deskKey}` },
    openGraph: { title, description },
    robots: pageRobots(n >= 10),
  };
}

export default async function CuriousDeskIndex({ params }: Props) {
  const { desk: deskKey } = await params;
  const desk = deskByKey(deskKey);
  if (!desk) notFound();
  const data = await load(deskKey);
  if (!data) notFound();
  const { rows, latest } = data;

  return (
    <div className="cur-wrap">
      <EntityTVHero reelSlugs={[...new Set(rows.map((e) => e.film.slug))]} label={desk.label} backdrop={null} />
      <header className="cur-head">
        <h1>{desk.label}<span className="q">.</span></h1>
        <p className="dek">
          {desk.blurb} {rows.length.toLocaleString()} films — every essay commissioned, written against a
          fixed contract, adversarially fact-checked at <Link href="/engine-room">The Engine Room</Link>,
          and published only if it survives.
        </p>
      </header>

      <section>
        <SectionHead title={`Latest from ${desk.deskName}`} />
        <div className="cur-grid">
          {latest.map((e, i) => (
            <Card
              key={`${e.film.slug}-${i}`}
              href={`/film/${e.film.slug}/${desk.key}`}
              film={e.film}
              title={mdToPlain(e.title)}
              tag={desk.label}
              date={e.published_at ?? e.created_at}
              spoilerNote={(e.spoiler_level ?? 0) >= 2}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHead title="All films, A–Z" count={`${rows.length.toLocaleString()} essays`} />
        <div className="cur-qindex">
          {rows.map((e, i) => {
            const d = e.published_at ?? e.created_at;
            return (
              <div className="cur-qindex__film" key={`${e.film.slug}-${i}`}>
                <Link href={`/film/${e.film.slug}/${desk.key}`}>
                  {e.film.title}
                  {e.film.year ? <span className="yr">({e.film.year})</span> : null}
                </Link>
                <ul>
                  <li>
                    <Link href={`/film/${e.film.slug}/${desk.key}`}>
                      {mdToPlain(e.title)}
                      <span className="m">
                        {" "}· {d ? monDate(d) : ""}
                        {(e.spoiler_level ?? 0) >= 2 ? " · discusses the ending" : ""}
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cur-foot">
        <Link href="/curious">← Curious — all questions &amp; desks</Link>
      </div>
    </div>
  );
}
