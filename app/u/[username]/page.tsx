import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const dynamic = "force-dynamic";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = supabaseAnon();
  const { data } = await supabase.rpc("public_portfolio_meta", { p_username: username });
  const m = data as Meta | null;
  const name = m?.display_name || username;
  return {
    title: `${name} — film portfolio · Metatake`,
    description: m ? `${name} has logged ${m.seen_count} films on Metatake — a portfolio worth ${m.nav ?? 0} in cumulative prestige.` : `${username} on Metatake.`,
    robots: { index: false, follow: false },
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { username } = await params;
  const supabase = supabaseAnon();

  const [{ data: metaRaw }, { data: filmsRaw }] = await Promise.all([
    supabase.rpc("public_portfolio_meta", { p_username: username }),
    supabase.rpc("public_portfolio", { p_username: username }),
  ]);

  const meta = metaRaw as Meta | null;
  if (!meta) notFound();
  const films = (filmsRaw as Film[] | null) ?? [];

  const name = meta.display_name || meta.username;
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <main className="mt-wrap">
      <MetatakeNav />
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
