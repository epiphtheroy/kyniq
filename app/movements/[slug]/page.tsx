import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import PlaylistTVEmbed from "@/components/PlaylistTVEmbed";
import MovementHubClient from "@/components/MovementHubClient";
import ShareDock from "@/components/ShareDock";

export const revalidate = 1800;
// Empty list enables the on-demand Full Route Cache (ISR HIT) without
// prebuilding anything at build time.
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ slug: string }> };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const IMG = "https://image.tmdb.org/t/p";

export type MvFilm = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; authority: boolean; demand: number | null };
// Hidden catalog members of this hub, from movement_hidden_films() — already
// capped (24) and deterministically ordered (year desc, then slug) by the RPC;
// `total` carries the full hidden-membership count via a window function.
export type MvHiddenFilm = { slug: string; title: string; original_title: string | null; year: number | null; poster_path: string | null; total: number };
export type MvDetail = {
  kind: "national" | "movement";
  hub: { slug: string; label: string; kind: string; region: string | null; tier: string | null; status: string | null; country_code: string | null; description: string | null };
  films: MvFilm[];
  auteurs: { director: string; n: number }[];
};

// Cached per slug so the page is ISR-cached instead of re-querying on every
// request (uncached Supabase calls otherwise force dynamic rendering).
function load(slug: string): Promise<(MvDetail & { hidden: MvHiddenFilm[] }) | null> {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data } = await supabase.rpc("movement_detail", { p_slug: slug });
      const detail = (data as MvDetail | null) ?? null;
      if (!detail) return null;
      // Layer 2 — hidden catalog members of this hub (curation.film_hub is not
      // REST-exposed; this RPC mirrors movement_detail's join, minus visible).
      const { data: hidden } = await supabase.rpc("movement_hidden_films", { p_slug: slug, p_limit: 24 });
      return { ...detail, hidden: (hidden as MvHiddenFilm[] | null) ?? [] };
    },
    ["movement2", slug],
    { revalidate: 1800, tags: [`movement:${slug}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Not found" };
  const t = `${d.hub.label} — ${d.kind === "national" ? "national cinema" : "film movement"} · Metatake`;
  // Phase-0 origins final. Index hubs with enough films; keep thin hubs (<8) out of the index.
  const thin = (d.films?.length ?? 0) < 8;
  return { title: t, description: `The canon, auteurs and where to start with ${d.hub.label} on Metatake.`, alternates: { canonical: `/movements/${slug}` }, robots: thin ? { index: false, follow: true } : undefined };
}

export default async function MovementHub({ params }: Props) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d || !d.films) notFound();
  const hidden = d.hidden ?? [];
  const hiddenTotal = hidden[0]?.total ?? 0;
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="lh-crumb"><Link href="/movements">Movements</Link></div>
        <MovementHubClient d={d} />
        <div className="lh-share">
          <ShareDock variant="bar" path={`/movements/${slug}`} title={d.hub.label}
            hook={`${d.hub.label} — the films, ideas and close readings of the movement, on Metatake`}
            saveType="movement" saveRef={slug} />
          <ShareDock variant="fab" path={`/movements/${slug}`} title={d.hub.label} noSave />
        </div>

        {/* Layer 2 — the hidden catalog as members of this tradition. Server-
            rendered plain <a> list; these films' own pages stay out of the index. */}
        {hidden.length > 0 && (
          <section className="mvh-sec">
            <h2 className="mvh-h2">
              More from {d.hub.label} — not yet read closely <span className="lh-cnt">{hiddenTotal}</span>
            </h2>
            <p className="mvh-note">Catalog entries that belong to this tradition — each has its own film page; the close readings are still to come.</p>
            <div className="mvh-films">
              {hidden.map((f) => (
                <a className="mvh-film" key={f.slug} href={`/film/${f.slug}`}>
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="mvh-poster" src={`${IMG}/w185${f.poster_path}`} alt="" width={185} height={278} loading="lazy" />
                  ) : <div className="mvh-poster mvh-poster--empty" aria-hidden="true" />}
                  <div className="mvh-fmeta">
                    <div className="mvh-ftitle">{f.title}{f.year ? <span className="mvh-yr"> ({f.year})</span> : null}</div>
                    {f.original_title && f.original_title !== f.title ? <div className="mvh-fdir">{f.original_title}</div> : null}
                  </div>
                </a>
              ))}
            </div>
            {hiddenTotal > hidden.length ? (
              <p className="mvh-note" style={{ marginTop: 16 }}>+ {hiddenTotal - hidden.length} more in the archive.</p>
            ) : null}
          </section>
        )}

        <PlaylistTVEmbed slug={`lineage-${slug}`} />
      </div>
    </div>
  );
}
