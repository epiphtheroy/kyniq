import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/home2/Nav";
import { fw } from "@/lib/frameworks";
import "@/app/home2.css";

export const revalidate = 1800;

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  theorist_name: string | null; theorist_slug: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

async function load(slug: string) {
  const supabase = db();
  const { data: c } = await supabase.from("sm_concepts").select("name, native").eq("slug", slug).maybeSingle();
  if (!c) return null;
  const { data: rd } = await supabase.rpc("sm_concept_readings", { p_slug: slug });
  const readings = (rd as Reading[] | null) ?? [];
  // Dominant theorist across the readings (for the masthead "after …" line).
  const counts = new Map<string, { name: string; slug: string | null; n: number }>();
  for (const r of readings) {
    if (!r.theorist_name) continue;
    const e = counts.get(r.theorist_name) ?? { name: r.theorist_name, slug: r.theorist_slug, n: 0 };
    e.n += 1;
    counts.set(r.theorist_name, e);
  }
  const theorist = [...counts.values()].sort((a, b) => b.n - a.n)[0] ?? null;
  return {
    name: (c as { name: string }).name,
    native: (c as { native: string | null }).native ?? null,
    readings,
    theorist,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Concept — Metatake" };
  return {
    title: `${data.name} in film — readings that stage it`,
    description: `${data.name} in cinema: ${data.readings.length} Strong Misreadings that read films through ${data.name}.`,
    alternates: { canonical: `/idea/${slug}` },
  };
}

export default async function IdeaPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { name, native, readings, theorist } = data;

  return (
    <>
      {/* Header zone — home v7 design language, for visual continuity with the main page. */}
      <div className="mthome">
        <Nav />
        <section className="dhead">
          <div className="dwrap">
            <div className="crumb"><Link href="/theorist">Theory</Link> › <Link href="/idea">Concepts</Link></div>
            <div className="kicker">Concept · Theory</div>
            <h1 className="dtitle">
              {name}
              {native ? <span className="dnative">{native}</span> : null}
            </h1>
            <p className="dmeta">
              {readings.length} film{readings.length !== 1 ? "s" : ""} read through this idea
              {theorist ? (
                <>
                  {" · after "}
                  {theorist.slug
                    ? <Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link>
                    : <b>{theorist.name}</b>}
                </>
              ) : null}
            </p>
            <div className="dtabs"><span className="on">Readings</span></div>
          </div>
        </section>
      </div>

      {/* Body — unchanged: white, readable, copy-friendly readings list. */}
      <div className="mt">
        <div className="mt-wrap">
          <p className="th-sub" style={{ marginTop: 22 }}>Each a Strong Misreading that turns on <em>{name}</em>.</p>

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
          <p className="th-foot"><Link href="/idea">← All concepts</Link></p>
        </div>
      </div>
    </>
  );
}
