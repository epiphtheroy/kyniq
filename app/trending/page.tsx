import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 120;
export const metadata: Metadata = {
  title: "Trending — Metatake",
  description: "The meta takes drawing the most attention right now on Metatake.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; title: string; laconic: string | null; views: number; likes: number; films: number; score: number };

export default async function TrendingPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const sp = await searchParams;
  const win = sp.window === "week" ? "week" : "all";
  const supabase = db();
  const [{ data }, { data: tropeRaw }] = await Promise.all([
    supabase.rpc("trending_meta_takes", { p_window: win, p_limit: 40 }),
    supabase.from("trope_counts").select("slug, title, laconic, figures, films"),
  ]);
  const rows = (data as Row[]) ?? [];
  const tropes = ((tropeRaw as { slug: string; title: string; laconic: string | null; figures: number; films: number }[]) ?? [])
    .sort((a, b) => b.films - a.films || b.figures - a.figures)
    .slice(0, 20);

  return (
    <div className="mt">
      <MetatakeNav active="trending" />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none" }}>Trending</h1>
        <div className="mt-sortbar" style={{ margin: "2px 0 4px" }}>
          <span className="mt-sortbar__lbl">Window</span>
          <Link href="/trending?window=week" className={win === "week" ? "on" : undefined}>This week</Link>
          <Link href="/trending?window=all" className={win === "all" ? "on" : undefined}>All time</Link>
        </div>
        <p className="mt-sortbar__hint">
          {win === "week"
            ? "Ranked by views in the last 7 days, with likes and connectedness. Real-time view data is still accruing — rankings sharpen as the site is used."
            : "Ranked by total views and likes, with connectedness (how many films share each reading) as a baseline."}
        </p>

        <h2 className="mt-h2">Readings</h2>
        <ol className="tr-list">
          {rows.map((r, i) => (
            <li key={r.slug} className="tr-item">
              <span className="tr-rank">{i + 1}</span>
              <span className="tr-body">
                <Link href={`/take/${r.slug}`} className="tr-ttl">{r.title}</Link>
                {r.laconic ? <span className="tr-lac">{r.laconic}</span> : null}
                <span className="tr-stats">
                  {r.films} {r.films === 1 ? "film" : "films"}
                  {r.views > 0 ? <> · {r.views} {win === "week" ? "views this week" : "views"}</> : null}
                  {r.likes > 0 ? <> · ♥ {r.likes}</> : null}
                </span>
              </span>
            </li>
          ))}
          {rows.length === 0 ? <li className="mt-see">Nothing trending yet.</li> : null}
        </ol>

        {tropes.length > 0 && (
          <>
            <h2 className="mt-h2">Most widespread tropes</h2>
            <p className="mt-sortbar__hint">The figure-types that recur across the most films.</p>
            <ol className="trl">
              {tropes.map((t, i) => (
                <li key={t.slug} className="trl-item">
                  <span className="trl-rank">{i + 1}</span>
                  <Link href={`/trope/${t.slug}`} className="trl-ttl">{t.title}</Link>
                  {t.laconic ? <span className="trl-lac">{t.laconic}</span> : null}
                  <span className="trl-stats">{t.figures} figures · {t.films} films</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
