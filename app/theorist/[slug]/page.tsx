import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { fw } from "@/lib/frameworks";
import EntityMap from "@/components/EntityMap";
import theoristQid from "@/lib/theorist_qid.json";

export const revalidate = 1800;
// Empty list = nothing prebuilt at build, but its presence enables the
// on-demand Full Route Cache so generated pages are ISR-cached (HIT), not
// re-rendered dynamically on every request.
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  concept: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

// Cached per slug so the page is ISR-cached instead of re-querying on every
// request (uncached Supabase calls otherwise force dynamic rendering).
function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data: th } = await supabase.from("theorists").select("name, blurb").eq("slug", slug).maybeSingle();
      if (!th) return null;
      const { data: rd } = await supabase.rpc("theorist_readings", { p_slug: slug });
      return { name: (th as { name: string }).name, blurb: (th as { blurb: string | null }).blurb, readings: (rd as Reading[] | null) ?? [] };
    },
    ["theorist", slug],
    { revalidate: 1800, tags: [`theorist:${slug}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Theorist — Metatake" };
  return {
    title: `${data.name} in film — readings through ${data.name}`,
    description: `Films read through ${data.name}: ${data.readings.length} Strong Misreadings that borrow ${data.name}'s lens, across cinema.`,
    alternates: { canonical: `/theorist/${slug}` },
  };
}

export default async function TheoristPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { name, blurb, readings } = data;

  // Person + BreadcrumbList JSON-LD (trope-page inline pattern). sameAs anchors
  // the theorist to Wikidata when the slug has a machine-verified QID
  // (lib/theorist_qid.json, built by worker/theorist-qid/match.mjs).
  const canonical = `${SITE}/theorist/${slug}`;
  const qid = (theoristQid as Record<string, string>)[slug];
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Theorists", item: `${SITE}/theorist` },
      { "@type": "ListItem", position: 3, name, item: canonical },
    ] },
    { "@context": "https://schema.org", "@type": "Person", "@id": canonical, name, url: canonical,
      ...(blurb ? { description: blurb } : {}),
      ...(qid ? { sameAs: [`https://www.wikidata.org/wiki/${qid}`] } : {}) },
  ];

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/concept">Theory</Link> › <Link href="/theorist">Theorists</Link></div>
        <h1 className="th-h1">{name}</h1>
        {blurb ? <p className="th-blurb">{blurb}</p> : null}
        <p className="th-sub">{readings.length} film{readings.length !== 1 ? "s" : ""} read through {name} — each a Strong Misreading that borrows this lens.</p>

        <section className="cmap-sec cmap-sec--top" id="theorist-map">
          <h2 className="cmap-h2">{name} — connection map</h2>
          <p className="cmap-stat"><b>{readings.length}</b> readings · <b>{new Set(readings.map((r) => r.film_slug)).size}</b> films</p>
          <p className="cmap-intro">The figures, films and ideas read through {name} across Metatake&rsquo;s critical web. Click a node to open it.</p>
          <EntityMap api={`/api/map?type=theorist&key=${slug}`} full={`/map?m=critical&t=theorist&k=${slug}`} />
        </section>

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
                    {r.concept ? <span className="thr-concept">{r.concept}</span> : null}
                  </div>
                  <Link className="thr-title" href={href}>{r.take_title ?? r.fig_label}</Link>
                  {r.thesis ? <p className="thr-thesis">{r.thesis}</p> : null}
                  {r.leap ? <p className="thr-leap"><span className="thr-leap__l">The leap</span> {r.leap}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
        <p className="th-foot"><Link href="/theorist">← All theorists</Link></p>
      </div>
    </div>
  );
}
