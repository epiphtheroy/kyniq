import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Public (noindex) portfolio: the two RPCs only change when the user logs
// activity, so serve an edge-cached page (ISR) and cache the fetch per username
// in the Data Cache. Tagged portfolio:<username> so a profile update can bust it
// on demand via /api/revalidate; also refreshes at most every 5 minutes.
export const revalidate = 300;

const W342 = "https://image.tmdb.org/t/p/w342";

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Meta = {
  username: string; display_name: string | null; bio: string | null; avatar_url: string | null;
  seen_count: number; watchlist_count: number; rated_count: number;
  avg_prestige: number | null; nav: number | null;
};
type Film = { film_id: string; slug: string; title: string; year: number | null; poster_path: string | null; prestige: number | null };

interface Props { params: Promise<{ username: string }> }

// One cache entry per username, shared by generateMetadata and the page render.
function loadPortfolio(username: string) {
  return unstable_cache(
    async () => {
      const supabase = supabaseAnon();
      const [{ data: metaRaw }, { data: filmsRaw }] = await Promise.all([
        supabase.rpc("public_portfolio_meta", { p_username: username }),
        supabase.rpc("public_portfolio", { p_username: username }),
      ]);
      return {
        meta: (metaRaw as Meta | null),
        films: ((filmsRaw as Film[] | null) ?? []),
      };
    },
    ["public-portfolio", username],
    { revalidate: 300, tags: [`portfolio:${username}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const { meta: m } = await loadPortfolio(username);
  const name = m?.display_name || username;
  return {
    title: `${name} — film portfolio · Metatake`,
    description: m ? `${name} has logged ${m.seen_count} films on Metatake — a portfolio worth ${m.nav ?? 0} in cumulative prestige.` : `${username} on Metatake.`,
    alternates: { canonical: `/u/${username}` },
    robots: { index: false, follow: false },
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { username } = await params;

  const { meta, films } = await loadPortfolio(username);
  if (!meta) notFound();

  const name = meta.display_name || meta.username;
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <main className="mt-wrap">
      <SiteNav />
      <div className="mt">
        {/* Header */}
        <div className="up-head">
          <div className="up-av disp">{initial}</div>
          <div className="up-id">
            <h1 className="disp" style={{ fontSize: 25, margin: 0 }}>{name}</h1>
            <div className="ui muted" style={{ fontSize: 13, marginTop: 2 }}>@{meta.username} · film portfolio</div>
            {meta.bio && <p className="body" style={{ fontSize: 15.5, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "58ch" }}>{meta.bio}</p>}
          </div>
        </div>

        {/* NAV-style KPI strip */}
        <div className="me-kpi">
          <div className="me-k"><b>{meta.seen_count}</b><span>Films seen</span></div>
          <div className="me-k"><b>{meta.nav ?? 0}</b><span>NAV (Σ prestige)</span></div>
          <div className="me-k"><b>{meta.avg_prestige ?? "—"}</b><span>Avg prestige</span></div>
          <div className="me-k"><b>{meta.watchlist_count}</b><span>Watchlist</span></div>
        </div>

        {/* Portfolio grid */}
        <section style={{ marginTop: 24 }}>
          <div className="seclbl">Holdings · {films.length} films, by prestige</div>
          {films.length === 0 ? (
            <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "10px 0 0" }}>
              No public films yet.
            </p>
          ) : (
            <div className="up-grid">
              {films.map((f) => (
                <Link key={f.film_id} href={`/film/${f.slug}`} className="up-card">
                  <span className="up-poster">
                    {f.poster_path ? <img src={`${W342}${f.poster_path}`} alt={f.title} loading="lazy" /> : <span className="up-noposter">{f.title.charAt(0)}</span>}
                    {f.prestige != null && <span className="up-pscore">{Math.round(Number(f.prestige))}</span>}
                  </span>
                  <span className="up-t">{f.title}</span>
                  {f.year ? <span className="up-y">{f.year}</span> : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        <p className="ui muted" style={{ fontSize: 12, marginTop: 26, fontStyle: "italic" }}>
          A Metatake portfolio scores each film you&apos;ve seen by its standing in the canon. NAV is the sum of that prestige.
        </p>
      </div>
    </main>
  );
}
