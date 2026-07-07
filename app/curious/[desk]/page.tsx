import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";
import { deskByKey, mdToPlain } from "@/lib/desks";

/**
 * Curious desk index — the full, crawlable list of one desk's essays,
 * grouped by film (same shape as the question-desk index). Canonical
 * reading pages live at /film/[slug]/[desk]. Moved from
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
  film: { slug: string; title: string; year: number | null };
};

const mon = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function loadUncached(deskKey: string) {
  const desk = deskByKey(deskKey);
  if (!desk) return null;
  const supabase = db();
  const rows: ERow[] = [];
  for (let from = 0; from < 4000; from += 1000) {
    const { data } = await supabase
      .from("essays")
      .select("title, dek, spoiler_level, published_at, created_at, film:films!inner(slug, title, year, visible)")
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
  rows.sort((a, b) => (a.film.title || "").localeCompare(b.film.title || ""));
  return { rows };
}

function load(deskKey: string) {
  return unstable_cache(() => loadUncached(deskKey), ["curious-desk-1", deskKey], {
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
  const title = `${desk.label} — ${desk.deskName} · Curious · Metatake`;
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
  const { rows } = data;

  return (
    <div className="mt">
      <SiteNav />
      <div className="blg">
        <section className="blg-hero">
          <div className="blg-wrap">
            <p className="blg-kick"><span className="dot" /> Curious · {desk.deskName}</p>
            <h1>{desk.label}<span className="red">.</span></h1>
            <p className="dek">{desk.blurb}</p>
            <p className="intro">
              {rows.length.toLocaleString()} films. Every essay is commissioned, written against a fixed
              contract, adversarially fact-checked at{" "}
              <Link href="/engine-room">The Engine Room</Link>, and published only if it survives.
            </p>
            <p className="intro" style={{ marginTop: 8 }}><Link href="/curious">← Curious (all questions &amp; desks)</Link></p>
          </div>
        </section>

        <section className="blg-sec" style={{ paddingTop: 26 }}>
          <div className="blg-wrap">
            <div className="blg-sechd"><h3>All films, A–Z</h3><span className="when">{rows.length.toLocaleString()} essays</span></div>
            {rows.map((e, i) => {
              const d = e.published_at ?? e.created_at;
              return (
                <Link className="blg-edrow" key={`${e.film.slug}-${i}`} href={`/film/${e.film.slug}/${desk.key}`}>
                  <div className="d"><b>{e.film.year ?? ""}</b>{d ? mon(d) : ""}</div>
                  <div>
                    <div className="lead">{e.film.title}{e.film.year ? ` (${e.film.year})` : ""} — {mdToPlain(e.title)}</div>
                    {(e.spoiler_level ?? 0) >= 2 && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>discusses the ending</div>}
                  </div>
                  <span className="go">Read →</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
