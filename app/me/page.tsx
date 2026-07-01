import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/home2/SiteNav";
import MovieSearchAdd from "@/components/MovieSearchAdd";
import WatchlistPipeline, { type WLRow } from "@/components/WatchlistPipeline";
import PortfolioQuality, { type MeSummary } from "@/components/PortfolioQuality";
import WatchedScored, { type WatchedRow } from "@/components/WatchedScored";
import TasteRail, { type TasteRow } from "@/components/TasteRail";
import WWIRail, { type WwiRow } from "@/components/WWIRail";
import PortfolioNav, { type NavData } from "@/components/PortfolioNav";
import { FRAMEWORKS, fw } from "@/lib/frameworks";

type PB = {
  watched?: number; watchlist?: number; avg_rating?: number | null; my_takes?: number;
  framework?: Record<string, number>; country?: Record<string, number>; decade?: Record<string, number>;
  director?: Record<string, number>; trope?: Record<string, number>;
  canon?: Array<{ label: string; seen: number; total: number }>;
};
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My dashboard — Metatake",
  description: "Your followed films, figures and meta-takes, what you liked, and the takes you've written.",
  robots: { index: false, follow: false },
};

type Pin = { kind: string; entity_type: string; slug: string | null; film_slug: string | null; title: string | null; sub: string | null };

function hrefOf(p: Pin): string | null {
  if (p.entity_type === "film" && p.slug) return `/film/${p.slug}`;
  if (p.entity_type === "meta_take" && p.slug) return `/take/${p.slug}`;
  if (p.entity_type === "trope" && p.slug) return `/trope/${p.slug}`;
  if (p.entity_type === "figure" && p.slug && p.film_slug) return `/film/${p.film_slug}/figure/${p.slug}`;
  return null;
}
const KIND_LABEL: Record<string, string> = { film: "Film", meta_take: "Meta take", trope: "Trope", figure: "Figure" };

function PinList({ pins }: { pins: Pin[] }) {
  if (pins.length === 0) return <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>Nothing here yet.</p>;
  return (
    <ul className="me-list mt" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {pins.map((p, i) => {
        const href = hrefOf(p);
        return (
          <li key={i} style={{ padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
            <span className="ui muted" style={{ fontSize: 11, letterSpacing: ".09em", textTransform: "uppercase", marginRight: 8 }}>{KIND_LABEL[p.entity_type] ?? p.entity_type}</span>
            {href ? <Link href={href} style={{ fontSize: 16 }}>{p.title ?? "—"}</Link> : <span style={{ fontSize: 16 }}>{p.title ?? "—"}</span>}
            {p.sub && <span className="ui muted" style={{ fontSize: 13, marginLeft: 8 }}>{p.sub}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function MovieList({ rows }: { rows: Array<{ rating: number | null; film: { slug: string; title: string; year: number | null } }> }) {
  if (rows.length === 0) return <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>Nothing here yet.</p>;
  return (
    <ul className="me-list mt" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {rows.map((m, i) => (
        <li key={i} style={{ padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
          <Link href={`/film/${m.film.slug}`} style={{ fontSize: 16 }}>{m.film.title}</Link>
          <span className="ui muted" style={{ fontSize: 13, marginLeft: 8 }}>({m.film.year ?? "?"})</span>
          {m.rating ? <span style={{ color: "var(--accent)", marginLeft: 8 }}>★ {Number(m.rating).toFixed(1)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MeDashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/me");

  const { data: profile } = await supabase.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || profile?.username || user.email?.split("@")[0] || "you";

  const [{ data: pinsRaw }, { data: moviesRaw }, { data: takesRaw }, { data: pbRaw }, { data: wlRaw }] = await Promise.all([
    supabase.rpc("get_my_pins"),
    supabase.from("user_movies")
      .select("seen, watchlist, rating, added_at, film:films!inner(slug, title, year)")
      .order("added_at", { ascending: false }),
    supabase
      .from("takes")
      .select("id, rationale, register, status, created_at, meta_take:meta_takes!takes_meta_take_id_fkey(title, slug), figure:figures!inner(label, slug, film:films!inner(title, slug))")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_watchlist_scored"),
  ]);
  const [{ data: tsSummaryRaw }, { data: watchedScoredRaw }, { data: tasteRaw }, { data: wwiRaw }] = await Promise.all([
    supabase.rpc("me_takescore_summary"),
    supabase.rpc("me_watched_scored"),
    supabase.rpc("me_taste_neighbors", { p_limit: 8 }),
    supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 12 }),
  ]);
  const { data: navRaw } = await supabase.rpc("me_portfolio_nav");
  const tsSummary = (tsSummaryRaw as MeSummary | null) ?? null;
  const watchedScored = (watchedScoredRaw as WatchedRow[] | null) ?? [];
  const taste = (tasteRaw as TasteRow[] | null) ?? [];
  const wwi = (wwiRaw as WwiRow[] | null) ?? [];
  const navData = (navRaw as NavData | null) ?? null;

  // Saved (user_saves): readings/directors/lineage lists the user bookmarked
  const { data: savesRaw } = await supabase
    .from("user_saves").select("entity_type, entity_ref, created_at").eq("kind", "save")
    .order("created_at", { ascending: false });
  const saves = (savesRaw as Array<{ entity_type: string; entity_ref: string }> | null) ?? [];
  const takeRefs = saves.filter((s) => s.entity_type === "take").map((s) => s.entity_ref);
  const dirRefs = saves.filter((s) => s.entity_type === "director").map((s) => s.entity_ref);
  const linRefs = saves.filter((s) => s.entity_type === "lineage").map((s) => s.entity_ref);
  const trpRefs = saves.filter((s) => s.entity_type === "trope").map((s) => s.entity_ref);
  const [savedTakesRes, savedDirsRes, savedLinsRes, savedTrpsRes] = await Promise.all([
    takeRefs.length
      ? supabase.from("takes").select("id, take_title, framework, figure:figures!inner(label, slug, film:films!inner(title, slug))").in("id", takeRefs).eq("status", "published")
      : Promise.resolve({ data: [] }),
    dirRefs.length ? supabase.from("directors").select("slug, name").in("slug", dirRefs) : Promise.resolve({ data: [] }),
    linRefs.length ? supabase.from("lineage_lists").select("slug, label").in("slug", linRefs) : Promise.resolve({ data: [] }),
    trpRefs.length ? supabase.from("meta_takes").select("slug, title").in("slug", trpRefs).eq("kind", "figure_type") : Promise.resolve({ data: [] }),
  ]);
  const savedTakes = (savedTakesRes.data as unknown as Array<{ id: string; take_title: string | null; framework: string | null; figure: { label: string; slug: string; film: { title: string; slug: string } } }>) ?? [];
  const savedDirs = (savedDirsRes.data as Array<{ slug: string; name: string }> | null) ?? [];
  const savedLins = (savedLinsRes.data as Array<{ slug: string; label: string }> | null) ?? [];
  const savedTrps = (savedTrpsRes.data as Array<{ slug: string; title: string }> | null) ?? [];
  const savedCount = savedTakes.length + savedDirs.length + savedLins.length + savedTrps.length;
  const pb = (pbRaw ?? {}) as PB;
  const wlScored = (wlRaw as WLRow[] | null) ?? [];
  const seenFw = new Set(Object.keys(pb.framework ?? {}));
  const blindFw = FRAMEWORKS.filter((f) => f.key !== "INVITATION" && !seenFw.has(f.key)).slice(0, 6);

  const pins: Pin[] = (pinsRaw as Pin[] | null) ?? [];
  const follows = pins.filter((p) => p.kind === "follow");
  const likes = pins.filter((p) => p.kind === "like");
  const movies = (moviesRaw as unknown as Array<{ seen: boolean; watchlist: boolean; rating: number | null; film: { slug: string; title: string; year: number | null } }>) ?? [];
  const watched = movies.filter((m) => m.seen);
  const watchlist = movies.filter((m) => m.watchlist);
  const takes = (takesRaw as unknown as Array<{
    id: string; rationale: string; register: string | null; status: string; created_at: string;
    meta_take: { title: string; slug: string } | null;
    figure: { label: string; slug: string; film: { title: string; slug: string } };
  }>) ?? [];

  return (
    <main className="mt-wrap">
      <SiteNav />
      <div className="mt">
        <h1 className="disp" style={{ fontSize: 26, margin: "18px 0 2px" }}>My dashboard</h1>
        <p className="ui muted" style={{ fontSize: 13, margin: 0 }}>
          Signed in as <strong style={{ color: "var(--ink)" }}>{name}</strong>
          {profile?.username && <> · <Link href={`/u/${profile.username}`} className="mt-link">public profile</Link></>}
          {" "}· <Link href="/settings" className="mt-link">settings</Link>
        </p>

        {/* KPI strip */}
        <div className="me-kpi">
          <div className="me-k"><b>{pb.watched ?? watched.length}</b><span>Watched</span></div>
          <div className="me-k"><b>{pb.watchlist ?? watchlist.length}</b><span>Watchlist</span></div>
          <div className="me-k"><b>{pb.avg_rating ?? "—"}</b><span>Avg rating</span></div>
          <div className="me-k"><b>{pb.my_takes ?? takes.length}</b><span>My takes</span></div>
        </div>

        {/* Portfolio — canon coverage + reading blind spots */}
        {(watched.length > 0) && (
          <section style={{ marginTop: 22 }}>
            <div className="seclbl">Portfolio</div>
            {navData ? <PortfolioNav nav={navData} /> : null}
            {tsSummary ? <PortfolioQuality s={tsSummary} /> : null}
            {pb.canon && pb.canon.length > 0 ? (
              <div className="me-cov">
                {pb.canon.slice(0, 6).map((c) => {
                  const pct = c.total > 0 ? Math.round((c.seen / c.total) * 100) : 0;
                  return (
                    <div className="me-cov-row" key={c.label}>
                      <span className="me-cov-l">{c.label}</span>
                      <span className="me-cov-bar"><i style={{ width: `${pct}%` }} /></span>
                      <span className="me-cov-n">{c.seen}/{c.total}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {blindFw.length > 0 ? (
              <div className="me-blind">
                <span className="me-blind-k">Reading blind spots</span>
                {blindFw.map((f) => (
                  <Link key={f.key} className="me-chip" href={`/strong-misreadings/${f.slug}`} style={{ borderColor: f.color, color: f.color }}>{f.label}</Link>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {wwi.length > 0 ? (
          <section style={{ marginTop: 22 }}>
            <div className="seclbl">✦ Recommended for you · the balanced call</div>
            <p className="ui muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
              WWI ranks unseen films by <b>confidence × (utility · taste · standing)</b> — your taste, weighed against
              our TakeScore and each film&rsquo;s critical standing, and gated by how well-grounded the score is.
            </p>
            <WWIRail rows={wwi} />
          </section>
        ) : taste.length > 0 ? (
          <section style={{ marginTop: 22 }}>
            <div className="seclbl">✦ Recommended for you · by taste</div>
            <p className="ui muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Nearest to the films you rated highly — by shared readings, shown with their TakeScore.</p>
            <TasteRail rows={taste} />
          </section>
        ) : null}

        <section style={{ marginTop: 22 }}>
          <div className="seclbl">＋ Add a film</div>
          <MovieSearchAdd />
        </section>

        <section style={{ marginTop: 22 }}>
          <div className="seclbl">✓ Watched · {watched.length}{watchedScored.some((w) => w.v != null) ? " · by TakeScore" : ""}</div>
          {watchedScored.length > 0 ? <WatchedScored rows={watchedScored} /> : <MovieList rows={watched} />}
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">＋ Watchlist · {watchlist.length}{wlScored.some((w) => w.v != null) ? " · ranked by TakeScore" : ""}</div>
          {wlScored.length > 0 ? <WatchlistPipeline rows={wlScored} /> : <MovieList rows={watchlist} />}
        </section>

        {savedCount > 0 && (
          <section style={{ marginTop: 26 }}>
            <div className="seclbl">🔖 Saved · {savedCount}</div>
            {savedTakes.length > 0 && (
              <ul className="me-list" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                {savedTakes.map((t) => {
                  const F = fw(t.framework);
                  return (
                    <li key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <span className="ui" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: F.color, marginRight: 8 }}>{F.label}</span>
                      <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}#t-${t.id}`} style={{ fontSize: 15.5 }}>{t.take_title ?? t.figure.label}</Link>
                      <span className="ui muted" style={{ fontSize: 13, marginLeft: 8 }}>{t.figure.film.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {(savedDirs.length > 0 || savedLins.length > 0 || savedTrps.length > 0) && (
              <div className="me-blind" style={{ marginTop: 12 }}>
                {savedDirs.map((d) => <Link key={d.slug} className="me-chip" href={`/director/${d.slug}`}>♥ {d.name}</Link>)}
                {savedTrps.map((tr) => <Link key={tr.slug} className="me-chip" href={`/trope/${tr.slug}`}>{tr.title}</Link>)}
                {savedLins.map((l) => <Link key={l.slug} className="me-chip" href={`/lineage/${l.slug}`}>{l.label}</Link>)}
              </div>
            )}
          </section>
        )}

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">📌 Following · {follows.length}</div>
          <PinList pins={follows} />
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">♥ Liked · {likes.length}</div>
          <PinList pins={likes} />
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">My takes · {takes.length}</div>
          {takes.length === 0 ? (
            <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>
              You haven&apos;t written any takes yet. Open a figure and add your reading.
            </p>
          ) : (
            <ul className="me-list" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {takes.map((t) => (
                <li key={t.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
                  <div className="ui muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}`} style={{ color: "var(--lk-fig)", textDecoration: "none" }}>{t.figure.label}</Link>
                    <span style={{ color: "var(--subtle)" }}> · {t.figure.film.title}</span>
                    {t.register && <span style={{ color: "var(--subtle)" }}> · {t.register}</span>}
                    {t.status !== "published" && <span className="accent"> · {t.status}</span>}
                  </div>
                  <p className="body" style={{ fontSize: 15.5, lineHeight: 1.5, margin: 0, maxWidth: "62ch" }}>
                    {t.rationale.slice(0, 220)}{t.rationale.length > 220 ? "…" : ""}
                  </p>
                  {t.meta_take?.slug && (
                    <div className="ui" style={{ fontSize: 12, marginTop: 4 }}>
                      under <Link href={`/take/${t.meta_take.slug}`} className="mt-link">{t.meta_take.title}</Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
