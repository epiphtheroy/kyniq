import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import MetatakeNav from "@/components/MetatakeNav";
import MovieSearchAdd from "@/components/MovieSearchAdd";
import { FRAMEWORKS } from "@/lib/frameworks";

type PB = {
  watched?: number; watchlist?: number; avg_rating?: number | null; my_takes?: number;
  framework?: Record<string, number>; country?: Record<string, number>; decade?: Record<string, number>;
  director?: Record<string, number>; trope?: Record<string, number>;
  canon?: Array<{ label: string; seen: number; total: number }>;
};
type WL = { slug: string; title: string; year: number | null; wwi: number; canon: number; lineage: number; gap: number; reason: string };

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
    supabase.rpc("score_watchlist"),
  ]);
  const pb = (pbRaw ?? {}) as PB;
  const wl = (wlRaw as WL[] | null) ?? [];
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
      <MetatakeNav />
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

        <section style={{ marginTop: 22 }}>
          <div className="seclbl">＋ Add a film</div>
          <MovieSearchAdd />
        </section>

        <section style={{ marginTop: 22 }}>
          <div className="seclbl">✓ Watched · {watched.length}</div>
          <MovieList rows={watched} />
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">＋ Watchlist · {watchlist.length}{wl.length ? " · ranked by Why-Watch" : ""}</div>
          {wl.length > 0 ? (
            <ul className="me-list" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {wl.map((w) => (
                <li key={w.slug} className="me-wl">
                  <span className="me-wwi">{Math.round(Number(w.wwi))}</span>
                  <div className="me-wl-b">
                    <Link href={`/film/${w.slug}`} style={{ fontSize: 16 }}>{w.title}</Link>
                    {w.year ? <span className="ui muted" style={{ fontSize: 13, marginLeft: 6 }}>({w.year})</span> : null}
                    <div className="me-wl-sub">{w.reason} · <span className="ui muted">canon {Math.round(Number(w.canon))} · link {Math.round(Number(w.lineage))} · gap {Math.round(Number(w.gap))}</span></div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <MovieList rows={watchlist} />
          )}
        </section>

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
