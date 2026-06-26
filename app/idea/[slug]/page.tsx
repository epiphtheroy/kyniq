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

type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  theorist_name: string | null; theorist_slug: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

async function load(slug: string) {
  const supabase = db();
  // sm_concepts has RLS on with no anon policy, so read via a security-definer RPC.
  // It resolves a variant slug OR a canonical slug → representative member + clean name.
  const { data: head } = await supabase.rpc("sm_concept_head", { p_slug: slug });
  const h = (head as { resolved_slug: string; name: string; native: string | null }[] | null)?.[0];
  if (!h) return null;
  const { data: rd } = await supabase.rpc("sm_concept_readings", { p_slug: h.resolved_slug });
  return { name: h.name, readings: (rd as Reading[] | null) ?? [] };
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
  const { name, readings } = data;

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/idea">Concepts</Link></div>
        <h1 className="th-h1">{name}</h1>
        <p className="th-sub">{readings.length} film{readings.length !== 1 ? "s" : ""} read through <em>{name}</em> — each a Strong Misreading that turns on this idea.</p>

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
  );
}
