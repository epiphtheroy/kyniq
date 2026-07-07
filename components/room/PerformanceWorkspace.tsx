"use client";
/** /room/performance — the Performance instrument (spec §3.6).
 *  "How is my portfolio doing" — NAV hero with the real asset curve
 *  (me_nav_history 365d, 90d/1y/All), tier ladder (the ONLY canonical render of
 *  the ladder), Alpha from me_takescore_summary (its /room debut), NAV movers
 *  (me_recommend_wwi delta desc), and a client-derived milestone log.
 *  Invariants honored here:
 *   - NAV monotonicity covenant rendered verbatim in the page footer (always).
 *   - No fake numbers: failed RPCs render the shared .errcard; missing values
 *     render honest sentences, never zeros.
 *   - Score families never blend: alpha compares ★×20 to V as a GAP, disclosed
 *     in a .gloss formula, and the position inspector uses CinecodexCard. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { num, tierOf, TIER_STEPS, type WwiRow, type NavHistRow, type CollRow } from "@/lib/room/format";
import { STR } from "./strings";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import FormingCard from "./FormingCard";
import FilmRow from "./FilmRow";
import RecInsp, { type RecFilm } from "./RecInsp";
import CinecodexCard from "./CinecodexCard";
import Stars from "./Stars";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import CRow from "./insp/CRow";
import SelHead from "./insp/SelHead";

/* ── RPC payload types (PostgREST numerics can arrive as strings → num()) ── */
export type NavJson = {
  nav: number | string | null; n_watched: number | string | null; n_scored: number | string | null;
  essentials: number | string | null; avg_standing: number | string | null; lines: number | string | null;
};
export type AlphaJson = {
  n_watched: number | string | null; n_scored: number | string | null;
  median_ts: number | string | null; avg_v: number | string | null; avg_r: number | string | null;
  best: { slug: string; title: string; ts: number | string | null } | null;
  riskiest: { slug: string; title: string; r: number | string | null } | null;
  value_gap: number | string | null; n_gap: number | string | null;
};
/** null on any field = that RPC failed server-side → render .errcard, not zeros. */
export type PerformanceData = {
  nav: NavJson | null;
  hist: NavHistRow[] | null;
  alpha: AlphaJson | null;
  movers: WwiRow[] | null;
  /** Alpha's best/riskiest enriched with their full me_collection rows (may be null). */
  best: CollRow | null;
  riskiest: CollRow | null;
};

const FORMULA_TITLE =
  "S is the discounted sum of your seen films' Standing (ranked by Standing, ×0.85 per rank). " +
  "Watching adds to S; ratings never enter it — the curve cannot fall.";

const ErrCard = () => (
  <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
);

const fmtDelta = (d: number) => (d >= 10 ? String(Math.round(d)) : d.toFixed(1));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/* WwiRow → shared inspector input. λ=1.0 surface, so U = V − R. */
function toRecFilm(f: WwiRow, kept: boolean): RecFilm {
  const v = num(f.v), r = num(f.r);
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons, v, c: null, r, u: v != null && r != null ? Math.round(v - r) : num(f.ts),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier, kept,
  };
}

type ChartPt = { t: number; nav: number; day: string };

/** Inline-SVG asset curve — fixed 0–100 domain so the tier lines give context.
 *  Time-proportional x axis; only real snapshot rows are plotted (no synthesis). */
function NavCurve({ pts }: { pts: ChartPt[] }) {
  const W = 640, H = 200, L = 34, R = 14, T = 14, B = 24;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
  const y = (v: number) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.nav).toFixed(1)}`).join("");
  const area = `${line}L${x(t1).toFixed(1)},${y(0).toFixed(1)}L${x(t0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="pf-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="NAV asset curve">
      {TIER_STEPS.filter((s) => s.at > 0).map((s) => (
        <g key={s.tier}>
          <line x1={L} x2={W - R} y1={y(s.at)} y2={y(s.at)} stroke="var(--line2)" strokeDasharray="3 4" strokeWidth="1" />
          <text x={W - R} y={y(s.at) - 3} textAnchor="end" fontSize="8.5" fill="var(--faint)" fontFamily="var(--mono)">{s.tier} {s.at}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" />
      <text x={L - 6} y={y(0) + 3} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">0</text>
      <text x={L - 6} y={y(100) + 3} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">100</text>
      <text x={L} y={H - 7} fontSize="9" fill="var(--sub)" fontFamily="var(--mono)">{fmtDay(pts[0].day)}</text>
      <text x={W - R} y={H - 7} textAnchor="end" fontSize="9" fill="var(--sub)" fontFamily="var(--mono)">{fmtDay(last.day)}</text>
      <path d={area} fill="rgba(31,178,134,.09)" stroke="none" />
      <path d={line} fill="none" stroke="var(--safe)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.t)} cy={y(last.nav)} r="3.5" fill="var(--safe)" />
      <text x={x(last.t) - 8} y={Math.max(y(last.nav) - 8, 11)} textAnchor="end" fontSize="11" fill="var(--ink)" fontFamily="var(--mono)">{Math.round(last.nav)}</text>
    </svg>
  );
}

type Range = "90d" | "1y" | "all";
type Milestone = { day: string; text: string; value: string; approx: boolean };

export default function PerformanceWorkspace({ data }: { data: PerformanceData }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doKeep, doSeen, doDismiss, doRate } = useRoomActions();

  const [range, setRange] = useState<Range>("1y");

  const navErr = data.nav == null;
  const navV = num(data.nav?.nav);
  const watched = num(data.nav?.n_watched);
  const scored = num(data.nav?.n_scored);
  const essentials = num(data.nav?.essentials);
  const avgStanding = num(data.nav?.avg_standing);
  const lines = num(data.nav?.lines);
  const tier = tierOf(navV);
  const forming = !navErr && navV == null;

  /* ── asset curve points (real snapshots only; nav null = pre-formation) ── */
  const allPts = useMemo<ChartPt[]>(() => {
    return (data.hist ?? [])
      .map((h) => ({ t: Date.parse(`${String(h.day).slice(0, 10)}T00:00:00Z`), nav: num(h.nav), day: String(h.day) }))
      .filter((p): p is ChartPt => p.nav != null && Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
  }, [data.hist]);

  const chartPts = useMemo(() => {
    if (range === "all") return allPts;
    const cut = Date.now() - (range === "90d" ? 90 : 365) * 86400e3;
    return allPts.filter((p) => p.t >= cut);
  }, [allPts, range]);

  /* ── tier ladder ── */
  const nextStep = navV != null ? TIER_STEPS.find((s) => s.at > navV) : undefined;

  /* ── milestone log — client-derived tier crossings from nav_history ── */
  const milestones = useMemo<Milestone[]>(() => {
    const out: Milestone[] = [];
    let prev: number | null = null;
    for (const p of allPts) {
      if (prev == null) {
        out.push({ day: p.day, text: "NAV formed", value: String(Math.round(p.nav)), approx: false });
        for (const s of TIER_STEPS) {
          if (s.at > 0 && p.nav >= s.at) out.push({ day: p.day, text: `${s.tier} reached`, value: String(s.at), approx: true });
        }
      } else {
        for (const s of TIER_STEPS) {
          if (s.at > 0 && prev < s.at && p.nav >= s.at) out.push({ day: p.day, text: `Crossed into ${s.tier}`, value: String(s.at), approx: false });
        }
      }
      prev = p.nav;
    }
    return out.reverse(); // newest first
  }, [allPts]);

  /* ── NAV movers — delta desc top 6, session-gone filtered ── */
  const keptSet = useMemo(() => {
    const s = new Set<string>(session.kept);
    for (const f of data.movers ?? []) if (f.in_watchlist) s.add(f.slug);
    return s;
  }, [data.movers, session.kept]);

  const movers = useMemo(() => {
    if (data.movers == null) return null;
    return data.movers
      .filter((f) => !session.gone.has(f.slug))
      .map((f) => ({ f, d: num(f.delta) }))
      .filter((x): x is { f: WwiRow; d: number } => x.d != null && x.d > 0.05)
      .sort((a, b) => b.d - a.d)
      .slice(0, 6);
  }, [data.movers, session.gone]);

  /* ── actions (optimistic via SessionStore; inspector closes on row-killing acts) ── */
  const keep = useCallback((f: WwiRow) => { void doKeep(f.slug, f.title); }, [doKeep]);
  const seen = useCallback((f: WwiRow) => { insp.close(); void doSeen(f.slug, f.title); }, [insp, doSeen]);
  const dismiss = useCallback((f: WwiRow) => { insp.close(); void doDismiss(f.slug, f.title); }, [insp, doDismiss]);

  const openMover = useCallback((f: WwiRow) => {
    insp.select(
      <RecInsp
        f={toRecFilm(f, keptSet.has(f.slug))}
        onKeep={() => keep(f)}
        onSeen={() => seen(f)}
        onDismiss={() => dismiss(f)}
        onRate={(_, v) => { insp.close(); void doRate(f.slug, f.title, v); }}
      />,
      "Candidate · NAV mover");
  }, [insp, keptSet, keep, seen, dismiss, doRate]);

  /* ── alpha position inspector — full never-blend card from the collection row ── */
  const openPosition = useCallback((pick: { slug: string; title: string; k: string; v: string }, row: CollRow | null) => {
    if (!row) {
      insp.select(
        <div>
          <SelHead title={pick.title} href={`/room/film/${pick.slug}`} />
          <ICard icon="ti-chart-line" title="Position">
            <KV k={pick.k} v={pick.v} />
            <div className="emptyins">Full position data is not loaded here — open the appraisal for the complete card.</div>
          </ICard>
          <Link className="actbtn" href={`/room/film/${pick.slug}`} style={{ display: "block", textAlign: "center", fontSize: 11.5 }}>
            Open appraisal →
          </Link>
        </div>,
        "Position · Alpha");
      return;
    }
    const rating = session.reRated[row.slug] ?? num(row.rating);
    insp.select(
      <div>
        <SelHead
          title={row.title}
          sub={<>{row.year ?? "?"}{row.director ? ` · ${row.director}` : ""}</>}
          posterPath={row.poster_path}
          href={`/room/film/${row.slug}`}
        />
        <ICard icon="ti-chart-line" title="Position" right="Alpha">
          <KV k={pick.k} v={pick.v} />
        </ICard>
        <CinecodexCard
          d={{
            v: num(row.v), c: num(row.c), r: num(row.r), u: num(row.u),
            prestige: num(row.prestige), discovery: num(row.discovery), conf: num(row.conf), tier: row.tier,
            imdb: num(row.imdb), rt: num(row.rt), meta: num(row.meta), votes: num(row.votes),
            ratingPct: rating != null ? rating * 20 : null,
          }}
          showBadge
          slug={row.slug}
        />
        <ICard icon="ti-star" title={STR.insp.myRating}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Stars value={rating ?? 0} onPick={(v) => { void doRate(row.slug, row.title, v); }} />
            <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{STR.insp.ratingHint}</span>
          </div>
        </ICard>
      </div>,
      "Position · Alpha");
  }, [insp, session.reRated, doRate]);

  /* ── alpha numbers ── */
  const alphaErr = data.alpha == null;
  const valueGap = num(data.alpha?.value_gap);
  const nGap = num(data.alpha?.n_gap) ?? 0;
  const medianTs = num(data.alpha?.median_ts);
  const best = data.alpha?.best ?? null;
  const riskiest = data.alpha?.riskiest ?? null;
  const gapGloss =
    `value gap = mean(your ★ × 20 − Cinecodex V) across ${nGap} rated, scored holdings. ` +
    "★ and V never blend — this is a disclosed comparison, not a merged score.";

  /* ── page brief (app-bar Brief button; never auto-opens) ── */
  const nextTxt = nextStep && navV != null ? `${nextStep.at - navV} NAV to ${nextStep.tier}` : navV != null ? "APEX — top of the ladder" : "—";
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-chart-line" title="Performance" right={tier}>
          <KV k="NAV" v={navV ?? "—"} />
          <KV k="Films seen" v={watched ?? "—"} />
          <KV k="Next tier" v={nextTxt} />
          <KV k="Movers ranked" v={movers ? movers.length : "—"} />
        </ICard>
        <div className="emptyins">{STR.common.navCovenant}</div>
      </div>
    );
  }, [setDefault, tier, navV, watched, nextTxt, movers]);

  return (
    <div className="v2wrap">
      {/* header */}
      <div>
        <h1 className="v2title">Performance</h1>
        <p className="v2sub">Your asset curve — NAV, tier ladder, alpha, and what moves it next.</p>
      </div>

      {/* forming gate / hero */}
      {navErr ? <ErrCard /> : null}
      {forming ? (
        <FormingCard feature="NAV" need={8} have={watched ?? 0} unit="seen films">
          {STR.empty.performance(watched ?? 0)}
        </FormingCard>
      ) : null}

      {!navErr && !forming ? (
        <>
          {/* ① NAV hero — big mono NAV + tier + asset curve + composition */}
          <section className="pf-hero">
            <div className="pf-htop">
              <div>
                <div className="eb">NAV</div>
                <div className="pf-navbig">{navV}</div>
              </div>
              <span className="pf-tier">{tier}</span>
              <div className="xseg" role="tablist" aria-label="Curve range">
                {(["90d", "1y", "all"] as const).map((r) => (
                  <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>
                    {r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>

            {data.hist == null ? (
              <ErrCard />
            ) : chartPts.length >= 2 ? (
              <NavCurve pts={chartPts} />
            ) : (
              <div className="pf-chartnote">
                {allPts.length <= 1
                  ? "One day of history so far — the curve appears from your second snapshot. Snapshots log whenever your seen set changes."
                  : "No snapshots in this range — widen the range to see the curve."}
              </div>
            )}

            <div className="pf-comp">
              <div>
                <CRow label="Avg standing" value={avgStanding} />
                <CRow
                  label="Scored"
                  value={scored}
                  max={Math.max(watched ?? 0, 1)}
                  text={scored != null && watched != null ? `${scored}/${watched}` : "—"}
                />
                <CRow
                  label="Essentials"
                  value={essentials}
                  max={Math.max(watched ?? 0, 1)}
                  text={essentials != null ? String(essentials) : "—"}
                  color="var(--canon)"
                />
              </div>
              <div>
                <KV k="Films seen" v={watched ?? "—"} />
                <KV k="Lines touched" v={lines ?? "—"} title="Distinct lineages your seen films appear in (canon · award · national · festival · section)." />
                <KV k="Tier" v={tier} />
              </div>
            </div>
          </section>

          {/* ② Tier ladder — the single canonical render */}
          <section className="mod">
            <div className="modh"><h3><i className="ti ti-stairs-up" /> Tier ladder</h3></div>
            <div className="modbody">
              <div className="pf-ladder">
                <div className="pf-ltrack">
                  <span className="fill" style={{ width: `${Math.min(100, Math.max(0, navV ?? 0))}%` }} />
                  {TIER_STEPS.filter((s) => s.at > 0).map((s) => (
                    <span key={s.tier} className="pf-ltick" style={{ left: `${s.at}%` }} />
                  ))}
                  {navV != null ? <span className="pf-lmark" style={{ left: `calc(${Math.min(100, navV)}% - 1px)` }} title={`You · NAV ${navV}`} /> : null}
                </div>
                {TIER_STEPS.map((s) => (
                  <span key={s.tier} className={`pf-lstep${s.at === 0 ? " s0" : ""}${tier === s.tier ? " here" : ""}`} style={{ left: `${s.at}%` }}>
                    {s.tier}{s.at > 0 ? ` ${s.at}` : ""}
                  </span>
                ))}
              </div>
              <div className="pf-lnext">
                {nextStep && navV != null
                  ? <><b>{nextStep.at - navV}</b> NAV points to <b>{nextStep.tier}</b></>
                  : <>APEX — the top of the ladder.</>}
              </div>
              <div className="pf-formula">
                <span className="gloss" title={FORMULA_TITLE}>NAV = 100·(1−0.5^(S/1.4))</span>
              </div>
            </div>
          </section>

          {/* ③ Alpha — me_takescore_summary's /room debut */}
          <section className="mod">
            <div className="modh"><h3><i className="ti ti-trending-up" /> Alpha</h3><span className="meta">your ★ vs the codex</span></div>
            <div className="modbody">
              {alphaErr ? (
                <ErrCard />
              ) : valueGap == null || nGap === 0 ? (
                <div className="emptyins">No alpha yet — rate films that Cinecodex has scored and the gap appears here.</div>
              ) : (
                <>
                  <div className="pf-ahead">
                    {valueGap > 0
                      ? <>Your alpha: you rate <b className="mono">+{valueGap}</b> above the market.</>
                      : valueGap < 0
                        ? <>You run colder than the market: <b className="mono">{valueGap}</b> on average.</>
                        : <>You rate exactly at market.</>}
                  </div>
                  <div className="pf-asub">
                    <span className="gloss" title={gapGloss}>value gap · {nGap} rated, scored holdings</span>
                  </div>
                  <div className="pf-astats">
                    <div className="pf-astat">
                      <div className="an">{medianTs ?? "—"}</div>
                      <div className="al">Median TakeScore</div>
                      <div className="at" title="U = V − R across your scored holdings — an aggregate, so no single film to open.">across your holdings</div>
                    </div>
                    {best ? (
                      <div
                        className="pf-astat clk" role="button" tabIndex={0}
                        onClick={() => openPosition({ slug: best.slug, title: best.title, k: "TakeScore (U)", v: String(num(best.ts) ?? "—") }, data.best)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPosition({ slug: best.slug, title: best.title, k: "TakeScore (U)", v: String(num(best.ts) ?? "—") }, data.best); } }}
                      >
                        <div className="an">{num(best.ts) ?? "—"}</div>
                        <div className="al">Best position</div>
                        <div className="at">{best.title}</div>
                      </div>
                    ) : (
                      <div className="pf-astat"><div className="an">—</div><div className="al">Best position</div><div className="at">no scored holding yet</div></div>
                    )}
                    {riskiest ? (
                      <div
                        className="pf-astat clk" role="button" tabIndex={0}
                        onClick={() => openPosition({ slug: riskiest.slug, title: riskiest.title, k: "Risk (R)", v: String(num(riskiest.r) ?? "—") }, data.riskiest)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPosition({ slug: riskiest.slug, title: riskiest.title, k: "Risk (R)", v: String(num(riskiest.r) ?? "—") }, data.riskiest); } }}
                      >
                        <div className="an risk">{num(riskiest.r) ?? "—"}</div>
                        <div className="al">Riskiest holding</div>
                        <div className="at">{riskiest.title}</div>
                      </div>
                    ) : (
                      <div className="pf-astat"><div className="an">—</div><div className="al">Riskiest holding</div><div className="at">no scored holding yet</div></div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* ④ NAV movers — watching these moves your NAV most */}
      <section className="mod">
        <div className="modh">
          <h3><i className="ti ti-arrow-up-right" /> NAV movers</h3>
          <span className="meta">watching these moves your NAV most</span>
        </div>
        <div className="modbody">
          {movers == null ? (
            <ErrCard />
          ) : movers.length ? (
            <>
              {movers.map(({ f, d }) => (
                <FilmRow
                  key={f.slug}
                  f={{
                    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
                    chip: { cls: "canon", label: `+${fmtDelta(d)} NAV` },
                    avail: f.avail, risk: num(f.r), kept: keptSet.has(f.slug),
                  }}
                  onOpen={() => openMover(f)}
                  onKeep={() => keep(f)}
                  onSeen={() => seen(f)}
                  onDismiss={() => dismiss(f)}
                />
              ))}
              <div style={{ marginTop: 10 }}>
                <Link href="/room/screener" style={{ fontSize: 11.5, color: "var(--sub)" }}>Full screener →</Link>
              </div>
            </>
          ) : (
            <div className="emptyins">No ranked movers right now — the <Link href="/room/screener" style={{ color: "var(--mut)" }}>Screener</Link> holds the full candidate list.</div>
          )}
        </div>
      </section>

      {/* ⑤ Milestone log — tier crossings derived client-side from nav_history */}
      {!navErr && !forming ? (
        <section className="mod">
          <div className="modh"><h3><i className="ti ti-flag" /> Milestones</h3><span className="meta">derived from your NAV history</span></div>
          <div className="modbody">
            {data.hist == null ? (
              <ErrCard />
            ) : milestones.length ? (
              milestones.map((m, i) => (
                <div className="pf-mile" key={`${m.day}-${m.text}-${i}`}>
                  <span className="md">{m.approx ? `by ${m.day.slice(0, 10)}` : m.day.slice(0, 10)}</span>
                  <i className="ti ti-flag-filled" />
                  <span>{m.text} · <b>{m.value}</b>{m.approx ? " (records begin here)" : ""}</span>
                </div>
              ))
            ) : (
              <div className="emptyins">No crossings yet — BUILDING starts at NAV 45.</div>
            )}
          </div>
        </section>
      ) : null}

      {/* covenant footer — verbatim, always present (spec §1 invariant 3) */}
      <div className="pf-covenant"><i className="ti ti-lock" />{STR.common.navCovenant}</div>
    </div>
  );
}
