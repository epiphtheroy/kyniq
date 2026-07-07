"use client";
/** /room/ledger — the complete rating ledger (v3, spec §3.4). Not a 40-row teaser:
 *  QuickRate log bar → me_rate_stats stats row (+ Masquerade forming meter) →
 *  GitHub-style activity heatmap (client-computed from me_collection.added_at) →
 *  full history entries (50/page, inline re-rate, filters) → rating histogram
 *  side panel → similar-texture strip after a ★4+ rating (me_taste_neighbors).
 *  All mutations go through useRoomActions; entries come from loadCollection()
 *  (.range() chunks — 1000-row-cap safe). Ratings never touch NAV. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { num, IMG, IMG185, type CollRow } from "@/lib/room/format";
import { STR } from "./strings";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import RecInsp, { type RecFilm } from "./RecInsp";
import QuickRate, { type QuickHit } from "./QuickRate";
import Stars from "./Stars";
import FormingCard from "./FormingCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";

/** me_rate_stats row (numerics may arrive as strings — coerce with num()). */
export type RateStats = {
  rated: number | string; loved: number | string; seen: number | string; watchlist: number | string;
  session_new: number | string; forming: boolean; loved_target: number | string;
};

type NeighborRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null; sim: number | string | null;
};

const PAGE = 50;
const STAR_OPTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type HmDay = { date: string; count: number; inYear: boolean };
type HmWeek = { label: string | null; days: HmDay[] };
type WeekFilter = { start: string; end: string };

/** GitHub-style year grid: columns = weeks (Sunday-first), rows = weekdays.
 *  Built entirely client-side from added_at dates (UTC date part). */
function buildYearGrid(counts: ReadonlyMap<string, number>, year: number): HmWeek[] {
  const cur = new Date(Date.UTC(year, 0, 1));
  cur.setUTCDate(cur.getUTCDate() - cur.getUTCDay()); // back up to the Sunday on/before Jan 1
  const end = Date.UTC(year, 11, 31);
  const weeks: HmWeek[] = [];
  let lastMonth = -1;
  while (cur.getTime() <= end) {
    const days: HmDay[] = [];
    let label: string | null = null;
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      const inYear = cur.getUTCFullYear() === year;
      if (inYear && cur.getUTCMonth() !== lastMonth) { label = MONTHS[cur.getUTCMonth()]; lastMonth = cur.getUTCMonth(); }
      days.push({ date: iso, count: counts.get(iso) ?? 0, inYear });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push({ label, days });
  }
  return weeks;
}

const levelOf = (c: number) => (c <= 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4);

const toRecFilm = (f: CollRow): RecFilm => ({
  slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
  rating: num(f.rating), v: num(f.v), c: num(f.c), r: num(f.r), u: num(f.u),
  prestige: num(f.prestige), discovery: num(f.discovery), conf: num(f.conf), tier: f.tier,
});

export default function LedgerWorkspace({ stats, rows }: { stats: RateStats; rows: CollRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { supabase, session, doKeep, doRate } = useRoomActions();

  /* Films rated this session that are NOT in the server snapshot yet (new entries).
     Re-rates of existing rows flow through the SessionStore reRated overlay instead. */
  const [fresh, setFresh] = useState<CollRow[]>([]);
  const [sessRates, setSessRates] = useState(0);
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([]);

  /* Entry filters */
  const [q, setQ] = useState("");
  const [starMin, setStarMin] = useState<number | null>(null);
  const [starMax, setStarMax] = useState<number | null>(null);
  const [lovedOnly, setLovedOnly] = useState(false);
  const [yearSel, setYearSel] = useState<string>("all");
  const [wk, setWk] = useState<WeekFilter | null>(null);
  const [page, setPage] = useState(1);
  const [hmYear, setHmYear] = useState<number | null>(null);

  /* ── merged entries: fresh first, reRated overlay applied, added_at desc ── */
  const entries = useMemo(() => {
    const dup = new Set(fresh.map((r) => r.slug));
    const all = [...fresh, ...rows.filter((r) => !dup.has(r.slug))];
    const over = session.reRated;
    return all
      .map((r) => (over[r.slug] != null ? { ...r, rating: over[r.slug] } : r))
      .sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""));
  }, [rows, fresh, session.reRated]);

  /* Cumulative counts are derived from the ledger itself so inline re-rates and
     session logs update them live (self-consistent — no fake numbers). */
  const ratedN = useMemo(() => entries.filter((r) => num(r.rating) != null).length, [entries]);
  const lovedN = useMemo(() => entries.filter((r) => (num(r.rating) ?? 0) >= 4.5).length, [entries]);
  const todayN = (num(stats.session_new) ?? 0) + sessRates;
  const lovedTarget = num(stats.loved_target) ?? 8;

  /* ── one-stroke rate: rate_film via doRate → new films prepend as fresh entries;
        ★4+ triggers the similar-texture strip (me_taste_neighbors) ── */
  const rate = useCallback(async (f: { slug: string; title: string; year?: number | null; poster_path?: string | null; director?: string | null }, value: number) => {
    const res = await doRate(f.slug, f.title, value);
    if (!res) return;
    const rating = num(res.rating) ?? value;
    setSessRates((n) => n + 1);
    setFresh((list) => {
      if (rows.some((r) => r.slug === f.slug) || list.some((r) => r.slug === f.slug)) return list; // existing entries update via the reRated overlay
      const row: CollRow = {
        slug: f.slug, title: f.title, year: num(f.year), poster_path: f.poster_path ?? null, director: f.director ?? null,
        rating, v: null, c: null, r: null, u: null, prestige: null, discovery: null, conf: null, tier: null,
        imdb: null, rt: null, meta: null, votes: null, added_at: new Date().toISOString(), facets: null,
      };
      return [row, ...list];
    });
    if (rating >= 4) {
      const { data } = await supabase.rpc("me_taste_neighbors", { p_limit: 4 });
      // Neighbors are unseen films — drop anything already acted on this session.
      setNeighbors(((data as NeighborRow[] | null) ?? []).filter((n) => !session.gone.has(n.slug)));
    }
  }, [doRate, supabase, rows, session.gone]);

  /* ── inspector (shared RecInsp — same 3 cards as everywhere else) ── */
  const openFilm = useCallback((f: CollRow) => {
    insp.select(<RecInsp f={toRecFilm(f)} onRate={(rf, v) => rate(rf, v)} />, f.title);
  }, [insp, rate]);

  const openNeighbor = useCallback((n: NeighborRow) => {
    const rf: RecFilm = {
      slug: n.slug, title: n.title, year: n.year, director: n.director, poster_path: n.poster_path,
      v: num(n.v), r: num(n.r), prestige: num(n.prestige),
    };
    insp.select(<RecInsp f={rf} onKeep={(x) => doKeep(x.slug, x.title)} onRate={(x, v) => rate(x, v)} />, n.title);
  }, [insp, doKeep, rate]);

  /* ── page brief (opened via the app-bar Brief button — never auto-opens) ── */
  useEffect(() => {
    setDefault(
      <ICard icon="ti-star" title="Ledger summary">
        <KV k="Entries (seen)" v={entries.length} />
        <KV k="Rated" v={ratedN} />
        <KV k="Loved (★4.5+)" v={lovedN} />
        <KV k="Today" v={todayN} />
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>Your ratings never touch NAV.</div>
      </ICard>
    );
  }, [setDefault, entries.length, ratedN, lovedN, todayN]);

  /* ── heatmap data (client-computed from added_at) ── */
  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of entries) {
      const d = (r.added_at ?? "").slice(0, 10);
      if (d) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [entries]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const d of dayCounts.keys()) ys.add(Number(d.slice(0, 4)));
    return [...ys].sort((a, b) => b - a);
  }, [dayCounts]);

  const hmY = hmYear ?? years[0] ?? new Date().getUTCFullYear();
  const grid = useMemo(() => buildYearGrid(dayCounts, hmY), [dayCounts, hmY]);
  const yearTotal = useMemo(() => {
    let t = 0;
    for (const [d, c] of dayCounts) if (d.slice(0, 4) === String(hmY)) t += c;
    return t;
  }, [dayCounts, hmY]);

  /* ── entry filters → view ── */
  const view = useMemo(() => {
    let a = entries;
    const t = q.trim().toLowerCase();
    if (t) a = a.filter((r) => r.title.toLowerCase().includes(t) || (r.director ?? "").toLowerCase().includes(t));
    if (starMin != null || starMax != null) {
      a = a.filter((r) => {
        const rt = num(r.rating);
        return rt != null && (starMin == null || rt >= starMin) && (starMax == null || rt <= starMax);
      });
    }
    if (lovedOnly) a = a.filter((r) => (num(r.rating) ?? 0) >= 4.5);
    if (yearSel !== "all") a = a.filter((r) => (r.added_at ?? "").slice(0, 4) === yearSel);
    if (wk) a = a.filter((r) => { const d = (r.added_at ?? "").slice(0, 10); return d >= wk.start && d <= wk.end; });
    return a;
  }, [entries, q, starMin, starMax, lovedOnly, yearSel, wk]);

  useEffect(() => { setPage(1); }, [q, starMin, starMax, lovedOnly, yearSel, wk]);

  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = view.slice((cur - 1) * PAGE, cur * PAGE);

  /* ── histogram (0.5–5 distribution + avg, client-computed) ── */
  const histo = useMemo(() => {
    const buckets = STAR_OPTS.map((v) => ({ v, n: 0 }));
    let sum = 0, n = 0;
    for (const r of entries) {
      const rt = num(r.rating);
      if (rt == null) continue;
      const b = buckets.find((x) => x.v === rt) ?? buckets[Math.min(9, Math.max(0, Math.round(rt * 2) - 1))];
      b.n += 1; sum += rt; n += 1;
    }
    const max = Math.max(1, ...buckets.map((b) => b.n));
    return { buckets, max, n, avg: n ? sum / n : null };
  }, [entries]);

  const header = (
    <div>
      <h1 className="v2title">Ledger</h1>
      <p className="v2sub">{ratedN} rated · {lovedN} loved{todayN ? ` · ${todayN} today` : ""} — rating implies seen.</p>
    </div>
  );

  /* ── empty ledger: log bar + honest copy (rating here IS the unlock) ── */
  if (entries.length === 0) {
    return (
      <div className="v2wrap">
        {header}
        <QuickRate onRate={(h: QuickHit, v) => rate(h, v)} />
        <div className="emptyins" style={{ textAlign: "left", padding: "10px 4px" }}>
          {STR.empty.ledger}{" "}
          <Link href="/me/import" style={{ color: "var(--mut)", textDecoration: "underline" }}>{STR.forming.importCta}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="v2wrap">
      {header}

      {/* ① log bar — same mutation contract as the Desk */}
      <QuickRate onRate={(h: QuickHit, v) => rate(h, v)} />

      {/* ② stats row + Masquerade forming meter (inline FormingCard variant) */}
      <section>
        <div className="kpis" style={{ marginBottom: lovedN < lovedTarget ? 10 : 0 }}>
          <div className="kpi"><div className="kl">Rated</div><div className="kn">{ratedN}</div><div className="ks">all time</div></div>
          <div className="kpi"><div className="kl">Loved</div><div className="kn">{lovedN}</div><div className="ks">★4.5+</div></div>
          <div className="kpi"><div className="kl">Today</div><div className="kn">{todayN}</div><div className="ks">star-taps</div></div>
        </div>
        {lovedN < lovedTarget ? (
          <div className="ledform">
            <FormingCard feature="Masquerade" need={lovedTarget} have={lovedN} unit="loved films (★4.5+)"
              cta={{ label: "Masquerade →", href: "/room/masquerade" }} showImport={false} />
          </div>
        ) : null}
      </section>

      {/* ⑥ similar-texture strip — appears after a ★4+ rating */}
      {neighbors.length ? (
        <section className="ledstrip">
          <div className="v2h"><h3>Similar texture</h3></div>
          <div className="postrip">
            {neighbors.map((n) => (
              <div className="pcard" key={n.slug}>
                <div className="ppo" style={n.poster_path ? { backgroundImage: `url(${IMG185}${n.poster_path})` } : {}} onClick={() => openNeighbor(n)} />
                <div className="pnt" title={n.title}>{n.title}</div>
                <button type="button" className={`pkeep${session.kept.has(n.slug) ? " done" : ""}`}
                  onClick={() => doKeep(n.slug, n.title)}>
                  {session.kept.has(n.slug) ? `✓ ${STR.row.kept}` : STR.row.keep}
                </button>
              </div>
            ))}
          </div>
          <p className="v2sub" style={{ marginTop: 6 }}>Unseen films interpretively close to what you just loved.</p>
        </section>
      ) : null}

      {/* ③ activity heatmap — client-computed, cell click filters entries to that week */}
      <section>
        <div className="mod" style={{ margin: 0 }}>
          <div className="modh"><h3><i className="ti ti-calendar-stats" /> Activity</h3><span className="meta">{yearTotal} entries in {hmY}</span></div>
          <div className="modbody">
            {years.length > 1 ? (
              <div className="hmtop">
                <div className="xseg">
                  {years.map((y) => (
                    <button key={y} type="button" className={y === hmY ? "on" : ""} onClick={() => { setHmYear(y); setWk(null); }}>{y}</button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="hm">
              {grid.map((w, i) => (
                <div className="hmw" key={i}>
                  <div className="hml">{w.label ?? ""}</div>
                  {w.days.map((d) => (
                    <span key={d.date}
                      className={`hmc l${levelOf(d.count)}${!d.inYear ? " off" : ""}${wk && d.date >= wk.start && d.date <= wk.end ? " on" : ""}`}
                      title={`${d.count} ${d.count === 1 ? "entry" : "entries"} · ${d.date}`}
                      onClick={() => { if (d.inYear) setWk({ start: w.days[0].date, end: w.days[6].date }); }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="hmhint">Click a cell to filter the entries below to that week.</div>
          </div>
        </div>
      </section>

      {/* ④ entries (full history, 50/page) + ⑤ histogram side panel */}
      <section className="leddual">
        <div>
          <div className="v2h"><h3>Entries</h3><span className="all" style={{ cursor: "default" }}>{view.length} shown</span></div>
          <div className="xtoolbar">
            <div className="xsearch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" /></div>
            <select className="select" value={starMin ?? ""} onChange={(e) => setStarMin(e.target.value === "" ? null : Number(e.target.value))} title="Minimum rating">
              <option value="">★ min</option>
              {STAR_OPTS.map((v) => <option key={v} value={v}>★ {v}+</option>)}
            </select>
            <select className="select" value={starMax ?? ""} onChange={(e) => setStarMax(e.target.value === "" ? null : Number(e.target.value))} title="Maximum rating">
              <option value="">★ max</option>
              {STAR_OPTS.map((v) => <option key={v} value={v}>≤ ★ {v}</option>)}
            </select>
            <div className={`findtoggle${lovedOnly ? " on" : ""}`} onClick={() => setLovedOnly((v) => !v)}><i className="ti ti-flame" /> Loved only</div>
            <select className="select" value={yearSel} onChange={(e) => setYearSel(e.target.value)} title="Filter by year logged">
              <option value="all">All years</option>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            {wk ? (
              <div className="findtoggle on" onClick={() => setWk(null)} title="Clear the week filter">
                <i className="ti ti-calendar-week" /> Week of {wk.start} <i className="ti ti-x" />
              </div>
            ) : null}
          </div>

          {slice.map((f) => {
            const rt = num(f.rating);
            return (
              <div key={f.slug} className="lrow" onClick={() => openFilm(f)}>
                <span className="fpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                <div style={{ minWidth: 0 }}>
                  <div className="ft">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
                </div>
                <Stars value={rt ?? 0} size={15} onPick={(v) => rate(f, v)} title={STR.insp.ratingHint} />
                <span className="ldate">{(f.added_at ?? "").slice(0, 10) || "—"}</span>
                <span className="lflame">{rt != null && rt >= 4.5 ? <i className="ti ti-flame" /> : null}</span>
              </div>
            );
          })}

          {view.length === 0 ? (
            <div className="emptyins">No entries match — adjust search or filters.</div>
          ) : (
            <div className="pgn">
              <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>←</button>
              <span className="pc">{cur}/{pages}</span>
              <button type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>→</button>
              <span className="pc">{(cur - 1) * PAGE + 1}–{Math.min(cur * PAGE, view.length)} of {view.length}</span>
            </div>
          )}
        </div>

        <aside>
          <div className="mod" style={{ margin: 0 }}>
            <div className="modh"><h3><i className="ti ti-chart-bar" /> Distribution</h3>
              <span className="meta">{histo.avg != null ? `avg ★${histo.avg.toFixed(2)}` : "no ratings"}</span></div>
            <div className="modbody">
              {histo.n ? (
                <div className="histo">
                  {histo.buckets.map((b) => (
                    <div className="hcol" key={b.v} title={`${b.n} × ★${b.v}`}>
                      <i className="hbar" style={{ height: `${Math.round((b.n / histo.max) * 72) + 2}px` }} />
                      <span className="hlbl">{b.v % 1 === 0 ? b.v : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyins">No ratings yet — tap a star on any entry.</div>
              )}
              <div className="hfoot">Your ratings never touch NAV.</div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
