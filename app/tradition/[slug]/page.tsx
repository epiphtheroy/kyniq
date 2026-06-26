import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { fw } from "@/lib/frameworks";

export const revalidate = 1800;

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Canon = { title: string; sub_category: string | null; major_category: string | null; part: string | null; theorist: string | null };
type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  theorist_name: string | null; theorist_slug: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

function clean(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title;
}

async function load(slug: string) {
  const supabase = db();
  const { data: c } = await supabase
    .from("theory_canon")
    .select("title, sub_category, major_category, part, theorist")
    .eq("slug", slug).maybeSingle();
  if (!c) return null;
  const { data: rd } = await supabase.rpc("canon_readings", { p_slug: slug });
  return { canon: c as Canon, readings: (rd as Reading[] | null) ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Tradition — Metatake" };
  const name = clean(data.canon.title);
  return {
    title: `${name} in film — readings that lean on it`,
    description: `${name} in cinema: ${data.readings.length} Strong Misreadings that lean on the tradition of ${name}${data.canon.theorist ? ` (${data.canon.theorist})` : ""}.`,
    alternates: { canonical: `/tradition/${slug}` },
  };
}

export default async function TraditionPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { canon, readings } = data;
  const name = clean(canon.title);
  const domain = [canon.sub_category, canon.major_category].filter(Boolean)[0] || null;

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/tradition">Traditions</Link></div>
        <h1 className="th-h1">{name}</h1>
        <p className="th-sub">
          {domain ? <span className="th-domain">{domain}</span> : null}
          {canon.theorist ? <> · <span className="th-by2">{canon.theorist}</span></> : null}
        </p>
        <p className="th-sub">{readings.length} film{readings.length !== 1 ? "s" : ""} read through the tradition of <em>{name}</em> — each a Strong Misreading that leans on it.</p>

        <div className="th-readings">
          {readings.map((r) => {
            const F = fw(r.framework);
            const href = `/film/${r.film_slug}/figure/${r.fig_slug}#t-${r.take_id}`;
            return (
              <article className="thr" key={r.take_id}>
                {r.backdrop_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Link href={href} className="thr-th"><img src={`${IMG}/w300${r.backdrop_path}`} alt="" loading="lazy" /></Link>
                ) : null}
                <div className="thr-body">
                  <div className="thr-top">
                    <span className="thr-fw" style={{ color: F.color }}>{F.label}</span>
                    <Link className="thr-film" href={`/film/${r.film_slug}`}>{r.film_title}{r.film_year ? ` (${r.film_year})` : ""}</Link>
                    {r.theorist_name ? (r.theorist_slug
                      ? <Link className="thr-concept" href={`/theorist/${r.theorist_slug}`}>{r.theorist_name}</Link>
                      : <span className="thr-concept">{r.theorist_name}</span>) : null}
                  </div>
                  <Link className="thr-title" href={href}>{r.take_title ?? r.fig_label}</Link>
                  {r.thesis ? <p className="thr-thesis">{r.thesis}</p> : null}
                  {r.leap ? <p className="thr-leap"><span className="thr-leap__l">The leap</span> {r.leap}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
        <p className="th-foot"><Link href="/tradition">← All traditions</Link></p>
      </div>
    </div>
  );
}
