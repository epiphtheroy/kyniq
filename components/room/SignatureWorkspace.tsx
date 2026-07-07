"use client";
/** Signature (/room/signature) — taste identity ONLY (spec §3.10).
 *  Replaces the v2 AnalysisWorkspace: asset analysis moved to Performance,
 *  lineage coverage moved to Coverage; each fact renders exactly once here.
 *   1 Signature hero — anchors (me_taste_signature 8) + generated one-liner +
 *     forming meter with the honest loved/loved_target denominator
 *     (the fake /50 ring is dead).
 *   2 Risk plane — V×R scatter over the FULL collection (page loads it via
 *     loadCollection() — fixes the live 1000-row truncation bug); labels only
 *     on hover/select; quadrant shading + formula footnote; dot → FilmInsp.
 *   3 Figure cloud — me_figure_cloud(28) → /trope/* links.
 *   4 Theory teaser — ONE line via /api/lens/entities (top theorist + top
 *     tradition); the full theory profile lives in Lens — no duplicate modules.
 *   5 Kindred films — me_taste_neighbors(8) with sim bars + Keep/Seen actions.
 *   6 Framework fingerprint — portfolio_breakdown().framework through the
 *     canonical 14 colors in lib/frameworks.ts.
 *  PostgREST numerics can arrive as strings — everything passes through num(). */
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import { num, type CollRow } from "@/lib/room/format";
import { fw as fwOf } from "@/lib/frameworks";
import { STR } from "./strings";
import FormingCard from "./FormingCard";
import CinecodexCard from "./CinecodexCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import SelHead from "./insp/SelHead";
import ActBar, { type Act } from "./insp/ActBar";

/* ── typed RPC rows ─────────────────────────────────────────────────── */
export type SigRow = { kind: string; label: string; films: number };
export type FigureRow = { label: string; slug: string; n: number; maturity: string | null };
export type NeighborRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null; sim: number | string | null;
};
export type Breakdown = {
  watched?: number; watchlist?: number; avg_rating?: number;
  framework?: Record<string, number>;
} | null;
export type RateStats = {
  rated: number | string | null; loved: number | string | null; seen: number | string | null;
  loved_target: number | string | null;
} | null;

/** null on any field = that RPC failed → the module renders the shared errcard. */
export type SignatureData = {
  signature: SigRow[] | null;
  breakdown: Breakdown; // null = failed OR empty jsonb — treated as empty (single-object RPC)
  collection: CollRow[] | null;
  figures: FigureRow[] | null;
  neighbors: NeighborRow[] | null;
  stats: RateStats;
};

type Film = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  rating: number | null; v: number | null; c: number | null; r: number | null; u: number | null;
  prestige: number | null; discovery: number | null; conf: number | null; tier: string | null;
  imdb: number | null; rt: number | null; meta: number | null; votes: number | null;
};

const ErrCard = () => (
  <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
);

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

/* ═══════════ inspector nodes ═══════════ */

/** Risk-plane dot → the film's never-blend summary (Standing beside Cinecodex). */
function FilmInsp({ f }: { f: Film }) {
  const rp = f.rating != null ? Math.round(f.rating * 20) : null;
  return (
    <div>
      <SelHead
        title={f.title}
        sub={<>{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</>}
        posterPath={f.poster_path}
        href={`/room/film/${f.slug}`}
      />
      <ICard icon="ti-building-bank" title={`${STR.cc.standing} · ${STR.cc.canon}`}>
        <div className="bigscore">{f.prestige != null ? Math.round(f.prestige) : "—"}</div>
        <KV k={STR.cc.discovery} v={f.discovery != null ? Math.round(f.discovery) : "—"} />
        <KV k={STR.insp.myRating} v={f.rating != null ? f.rating.toFixed(1) : "—"} />
      </ICard>
      <CinecodexCard
        d={{
          v: f.v, c: f.c, r: f.r, u: f.u, prestige: f.prestige, discovery: f.discovery,
          conf: f.conf, tier: f.tier, imdb: f.imdb, rt: f.rt, meta: f.meta, votes: f.votes, ratingPct: rp,
        }}
        showBadge
        slug={f.slug}
      />
    </div>
  );
}

/** Kindred (unseen taste neighbor) inspector — with Keep/Seen (dead-end fix). */
function NeighborInsp({ n, kept, onKeep, onSeen }: {
  n: { slug: string; title: string; year: number | null; director: string | null; poster_path: string | null; v: number | null; r: number | null; prestige: number | null; sim: number | null };
  kept: boolean;
  onKeep: () => void;
  onSeen: () => void;
}) {
  const [k, setK] = useState(kept);
  useEffect(() => setK(kept), [kept, n.slug]);
  const simPct = n.sim != null ? Math.round(n.sim * 100) : null;
  const acts: Act[] = [
    { label: k ? `✓ ${STR.row.kept}` : STR.row.keep, primary: true, disabled: k, onClick: () => { setK(true); onKeep(); } },
    { label: STR.row.seen, onClick: onSeen },
    { label: "Appraisal →", href: `/room/film/${n.slug}` },
  ];
  return (
    <div>
      <SelHead
        title={n.title}
        sub={<>{n.year ?? "?"}{n.director ? ` · ${n.director}` : ""} · unseen</>}
        posterPath={n.poster_path}
      />
      <ICard icon="ti-affiliate" title="Kindred · taste proximity">
        <div className="bigscore" style={{ color: "var(--reading)" }}>
          {simPct != null ? simPct : "—"}
          <span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 6 }}>/ 100 similarity</span>
        </div>
        <KV k="V Earned value" v={n.v != null ? Math.round(n.v) : "—"} />
        <KV k="R Risk" v={<span style={n.r != null && n.r >= 28 ? { color: "var(--risk)" } : undefined}>{n.r != null ? Math.round(n.r) : "—"}</span>} />
        <KV k={STR.cc.standing} v={n.prestige != null ? Math.round(n.prestige) : "—"} />
      </ICard>
      <ICard icon="ti-info-circle" title="Why it surfaced">
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          Cosine similarity <b style={{ color: "var(--reading)" }}>{n.sim != null ? n.sim.toFixed(3) : "—"}</b> to
          the centroid of your loved films — the nearest film you haven&rsquo;t seen.
          V·R are Cinecodex fundamentals ({STR.cc.neverBlend.toLowerCase()})
        </div>
      </ICard>
      <ICard icon="ti-player-play" title={STR.insp.actNow}>
        <ActBar acts={acts} style={{ marginTop: 0 }} />
      </ICard>
    </div>
  );
}

/* ═══════════ risk plane (V × R scatter) ═══════════ */
type Pt = { slug: string; title: string; x: number; y: number; kind: "mine" | "ideal" | "risk" };

const VR_W = 560, VR_H = 340;
const VR_X0 = 54, VR_X1 = VR_W - 40, VR_Y0 = 26, VR_Y1 = VR_H - 42;

function RiskPlaneSVG({ pts, centroid, selected, xTicks, yTicks, xToPx, yToPx, xMid, yMid, onDot, onCentroid }: {
  pts: Pt[];
  centroid: { x: number; y: number } | null;
  selected: string | null;
  xTicks: number[]; yTicks: number[];
  xToPx: (v: number) => number; yToPx: (v: number) => number;
  xMid: number; yMid: number;
  onDot: (slug: string) => void; onCentroid: () => void;
}) {
  return (
    <svg className="sg-scatter" viewBox={`0 0 ${VR_W} ${VR_H}`} role="img" aria-label="Risk plane — V earned value by R letdown risk">
      <rect x={VR_X0} y={VR_Y0} width={VR_X1 - VR_X0} height={VR_Y1 - VR_Y0} fill="#111114" stroke="#2c2c30" />
      {/* quadrant shading: ideal (high V · low R) vs divisive (high R) */}
      <rect x={VR_X0} y={VR_Y0} width={xMid - VR_X0} height={yMid - VR_Y0} fill="rgba(31,178,134,.05)" />
      <rect x={xMid} y={VR_Y0} width={VR_X1 - xMid} height={VR_Y1 - VR_Y0} fill="rgba(214,69,24,.055)" />
      {yTicks.map((v) => {
        const y = yToPx(v);
        return (
          <g key={`yt${v}`}>
            <line x1={VR_X0 - 4} y1={y} x2={VR_X0} y2={y} stroke="#3a3a40" />
            <text x={VR_X0 - 8} y={y + 3} textAnchor="end" fontSize="8.5" fill="#6C6960">{v}</text>
          </g>
        );
      })}
      {xTicks.map((v) => {
        const x = xToPx(v);
        return (
          <g key={`xt${v}`}>
            <line x1={x} y1={VR_Y1} x2={x} y2={VR_Y1 + 4} stroke="#3a3a40" />
            <text x={x} y={VR_Y1 + 15} textAnchor="middle" fontSize="8.5" fill="#6C6960">{v}</text>
          </g>
        );
      })}
      <text x={(VR_X0 + VR_X1) / 2} y={VR_Y1 + 29} textAnchor="middle" fontSize="9.5" fill="#9A968D">R Letdown risk →</text>
      <text x="15" y={(VR_Y0 + VR_Y1) / 2} textAnchor="middle" fontSize="9.5" fill="#9A968D" transform={`rotate(-90 15 ${(VR_Y0 + VR_Y1) / 2})`}>V Earned value ↑</text>
      <text x={VR_X0 + 8} y={VR_Y0 + 14} textAnchor="start" className="sg-quad" fill="#5fd0b2">high V · low R — the ideal zone</text>
      <text x={VR_X1 - 8} y={VR_Y0 + 14} textAnchor="end" className="sg-quad" fill="#f0937a">high R — divisive / risky</text>
      {/* dots — labels reveal on hover/selection only (CSS) */}
      {pts.map((p) => {
        const fill = p.kind === "ideal" ? "#5fd0b2" : p.kind === "risk" ? "var(--risk)" : "#ECEAE5";
        const rr = p.kind === "ideal" ? 5.5 : 4.5;
        const nearRight = p.x > VR_X1 - 90;
        return (
          <g key={p.slug} className={`sg-dot${selected === p.slug ? " sel" : ""}`} onClick={() => onDot(p.slug)}>
            <title>{p.title}</title>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={rr} fill={fill} {...(p.kind === "risk" ? { stroke: "#f0937a", strokeWidth: 1 } : {})} />
            <text x={nearRight ? p.x - 8 : p.x + 8} y={p.y + 3} textAnchor={nearRight ? "end" : "start"} fontSize="8" fontFamily="PT Serif,serif"
              fill={p.kind === "risk" ? "#f0937a" : p.kind === "ideal" ? "#5fd0b2" : "#b3afa6"}>{p.title}</text>
          </g>
        );
      })}
      {centroid ? (
        <g className="sg-dot" onClick={onCentroid}>
          <title>Your mean</title>
          <circle cx={centroid.x} cy={centroid.y} r={16} fill="transparent" />
          <path d={`M${centroid.x} ${centroid.y - 6} L${centroid.x + 6} ${centroid.y} L${centroid.x} ${centroid.y + 6} L${centroid.x - 6} ${centroid.y} Z`}
            fill="var(--red)" stroke="#fff" strokeWidth="0.8" />
        </g>
      ) : null}
    </svg>
  );
}

/* ═══════════ theory teaser (client fetch — Lens data contract) ═══════════ */
type TeaserState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; theorist: string | null; tradition: string | null };

function TheoryTeaser() {
  const [st, setSt] = useState<TeaserState>({ status: "loading" });
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const get = (kind: string) =>
          fetch(`/api/lens/entities?kind=${kind}&limit=1`, { cache: "no-store" })
            .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ rows?: { label: string }[] }>; });
        const [th, tr] = await Promise.all([get("theorists"), get("traditions")]);
        if (dead) return;
        setSt({ status: "done", theorist: th.rows?.[0]?.label ?? null, tradition: tr.rows?.[0]?.label ?? null });
      } catch {
        if (!dead) setSt({ status: "error" });
      }
    })();
    return () => { dead = true; };
  }, []);

  if (st.status === "loading") return <div className="sg-teaser"><i className="ti ti-telescope" /><span className="ghline w60" style={{ flex: 1, margin: 0 }} /></div>;
  if (st.status === "error") return <ErrCard />;
  return (
    <div className="sg-teaser">
      <i className="ti ti-telescope" />
      {st.theorist || st.tradition ? (
        <span>
          {st.theorist ? <>Top theorist across your films: <b>{st.theorist}</b></> : null}
          {st.theorist && st.tradition ? " · " : null}
          {st.tradition ? <>top tradition: <b>{st.tradition}</b></> : null}
        </span>
      ) : (
        <span>No published theorists or traditions cross your films yet — every film you log can bring its theory here.</span>
      )}
      <Link className="go" href="/room/lens">Your full theory profile → Lens</Link>
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function SignatureWorkspace({ data }: { data: SignatureData }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doKeep, doSeen } = useRoomActions();
  const [selDot, setSelDot] = useState<string | null>(null);

  /* normalize collection (string numerics → numbers) */
  const coll: Film[] = useMemo(() =>
    (data.collection ?? []).map((f) => ({
      slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
      rating: num(f.rating), v: num(f.v), c: num(f.c), r: num(f.r), u: num(f.u),
      prestige: num(f.prestige), discovery: num(f.discovery), conf: num(f.conf), tier: f.tier,
      imdb: num(f.imdb), rt: num(f.rt), meta: num(f.meta), votes: num(f.votes),
    })), [data.collection]);

  const neighbors = useMemo(() =>
    (data.neighbors ?? []).map((n) => ({
      slug: n.slug, title: n.title, year: n.year, director: n.director, poster_path: n.poster_path,
      v: num(n.v), r: num(n.r), prestige: num(n.prestige), sim: num(n.sim),
    })), [data.neighbors]);
  /* seen/dismissed this session drop out — they are no longer unseen kindred */
  const kindred = useMemo(() => neighbors.filter((n) => !session.gone.has(n.slug)), [neighbors, session.gone]);

  const anchors = useMemo(() => (data.signature ?? []).filter((s) => s.kind === "anchor"), [data.signature]);
  const lineages = useMemo(() => (data.signature ?? []).filter((s) => s.kind === "lineage"), [data.signature]);

  /* framework fingerprint — canonical 14 (INVITATION is the spoiler-free lead, not a reading) */
  const fwBars = useMemo(() => {
    const rec = data.breakdown?.framework ?? {};
    return Object.entries(rec)
      .filter(([k]) => k !== "INVITATION")
      .map(([k, n]) => ({ key: k, n: Number(n) || 0, def: fwOf(k) }))
      .sort((a, b) => b.n - a.n);
  }, [data.breakdown]);
  const fwMax = Math.max(1, ...fwBars.map((b) => b.n));

  const topAnchor = anchors[0]?.label ?? null;
  const topAnchor2 = anchors[1]?.label ?? null;
  const topLineage = lineages[0]?.label ?? null;
  const topFw = fwBars[0]?.def.label ?? null;

  const loved = num(data.stats?.loved) ?? 0;
  const lovedTarget = num(data.stats?.loved_target) ?? 8;

  /* ── risk plane geometry ── */
  const scored = useMemo(() => coll.filter((f) => f.v != null && f.r != null), [coll]);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const vBar = mean(scored.map((f) => f.v as number));
  const rBar = mean(scored.map((f) => f.r as number));
  const rSd = rBar != null ? Math.sqrt(scored.reduce((a, f) => a + ((f.r as number) - rBar) ** 2, 0) / scored.length) : 0;
  const idealCount = scored.filter((f) => (f.v as number) >= 70 && (f.r as number) <= 25).length;
  const riskCount = scored.filter((f) => (f.r as number) >= 28).length;

  const rMax = Math.max(60, ...scored.map((f) => f.r as number), rBar ?? 0);
  const vMin = 30, vMax = 100;
  const vrX = (r: number) => VR_X0 + (Math.max(0, Math.min(rMax, r)) / rMax) * (VR_X1 - VR_X0);
  const vrY = (v: number) => VR_Y1 - ((Math.max(vMin, Math.min(vMax, v)) - vMin) / (vMax - vMin)) * (VR_Y1 - VR_Y0);
  const vrPts: Pt[] = scored.map((f) => ({
    slug: f.slug, title: f.title, x: vrX(f.r as number), y: vrY(f.v as number),
    kind: (f.v as number) >= 70 && (f.r as number) <= 25 ? "ideal" : (f.r as number) >= 28 ? "risk" : "mine",
  }));

  const openFilm = (slug: string) => {
    const f = coll.find((x) => x.slug === slug);
    if (!f) return;
    setSelDot(slug);
    insp.select(<FilmInsp f={f} />, `${f.title} · Cinecodex`);
  };
  const openCentroid = () => insp.select(
    <div>
      <ICard icon="ti-crosshair" title="Portfolio mean — risk plane">
        <div className="bigscore" style={{ color: "var(--red)" }}>
          V̄ {vBar != null ? Math.round(vBar) : "—"}
          <span style={{ fontSize: 13, color: "var(--sub)", marginLeft: 8 }}>· R̄ {rBar != null ? Math.round(rBar) : "—"}</span>
        </div>
        <KV k="Risk std dev σR" v={rBar != null ? rSd.toFixed(1) : "—"} />
        <KV k="Ideal zone (high V · low R)" v={`${idealCount} / ${scored.length}`} />
        <KV k="Divisive (R ≥ 28)" v={<span style={{ color: "var(--risk)" }}>{riskCount}</span>} />
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 9, lineHeight: 1.55 }}>
          Upper-left is the ideal zone — high return, low letdown risk. The right side is divisive territory.
        </div>
      </ICard>
    </div>, "Your mean · risk plane");
  const openNeighbor = (n: (typeof kindred)[number]) => insp.select(
    <NeighborInsp
      n={n}
      kept={session.kept.has(n.slug)}
      onKeep={() => { void doKeep(n.slug, n.title); }}
      onSeen={() => { void doSeen(n.slug, n.title); }}
    />, `${n.title} · Kindred`);

  /* ── page brief ── */
  useEffect(() => {
    const prose: ReactNode = topAnchor ? (
      <>
        The thickest line across your films is <b>&ldquo;{topAnchor}&rdquo;</b>
        {topAnchor2 ? <> and <b>&ldquo;{topAnchor2}&rdquo;</b></> : null}.
        {topFw ? <> You read mostly through the <b>{topFw}</b> frame</> : null}
        {topLineage ? <>; your thickest lineage is <b>{topLineage}</b></> : null}.
        {" "}A signature is a way of seeing — not a genre.
      </>
    ) : (
      <>Not enough loved films (★4.5+) yet — rate more and the anchors that repeat across your films surface here.</>
    );
    setDefault(
      <div>
        <ICard icon="ti-fingerprint" title="Signature">
          <div style={{ fontSize: 13, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>{prose}</div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>
            Anchors = recurring figures across your loved (★4.5+) films — interpretive layers, not genres.
          </div>
        </ICard>
        <ICard icon="ti-chart-scatter" title="Risk plane">
          <KV k="Positions plotted" v={scored.length} />
          <KV k="Mean V̄" v={<span style={{ color: "#5fd0b2" }}>{vBar != null ? Math.round(vBar) : "—"}</span>} />
          <KV k="Mean R̄" v={<span style={{ color: "var(--risk)" }}>{rBar != null ? Math.round(rBar) : "—"}</span>} />
        </ICard>
        <div className="emptyins">Click a dot, a figure or a kindred film — details and the why open here.</div>
      </div>
    );
  }, [setDefault, topAnchor, topAnchor2, topFw, topLineage, scored.length, vBar, rBar]);

  return (
    <div className="mainpad">
      <h1 className="secttl">Signature</h1>
      <p className="secsub">
        Who you are as a reader — decoded from your{" "}
        <span className="gloss" title="The mean taste vector of your loved (★4.5+) films">taste vector</span>.
        Cinecodex V·R never blends with Standing or external signals.
      </p>

      {/* ═══ 1 · Signature hero ═══ */}
      {data.signature == null ? <ErrCard /> : anchors.length === 0 ? (
        <FormingCard feature="Signature" need={lovedTarget} have={loved} unit="loved films (★4.5+)">
          {STR.empty.signature(loved)} Anchors are the figures that repeat across films you love.
        </FormingCard>
      ) : (
        <div className="sg-hero">
          <div style={{ minWidth: 0 }}>
            <div className="eb">Taste signature</div>
            <div className="sg-hl">&ldquo;{topAnchor}&rdquo;</div>
            <div className="sg-prose">
              In one line: you keep returning to <span className="em">&ldquo;{topAnchor}&rdquo;</span>.
              {topLineage ? <> Your thickest lineage is <b>{topLineage}</b></> : null}
              {topFw ? <>{topLineage ? ", and you" : " You"} read mostly through the <b>{topFw}</b> frame.</> : topLineage ? "." : null}
            </div>
            <div className="sg-anchorchips">
              {anchors.map((a) => (
                <span key={a.label} className="sg-chip">{a.label}<span className="n">{a.films}</span></span>
              ))}
            </div>
            <div className="sg-foot">
              <i className="ti ti-function" style={{ color: "var(--canon)" }} /> Anchors = <b>figures ∼ figure types ∼ loved (★4.5+)</b> · lineages = <b>film lineage ∼ loved</b>. A way of seeing, not a genre.
            </div>
          </div>
          <div className="sg-meterbox">
            <div className="eb">Forming meter</div>
            {data.stats != null ? (
              <>
                <div className="sg-meterline">Loved films <b>{loved}</b> / {lovedTarget}</div>
                <div className="sg-meter" role="meter" aria-valuemin={0} aria-valuemax={lovedTarget} aria-valuenow={Math.min(loved, lovedTarget)}>
                  <i style={{ width: `${Math.min(100, Math.round((loved / Math.max(1, lovedTarget)) * 100))}%` }} />
                </div>
                <div className="sg-meternote">
                  {loved >= lovedTarget
                    ? "Signature formed — every new loved film sharpens it."
                    : `A signature forms from loved films (★4.5+) — ${lovedTarget - loved} more to fully form.`}
                </div>
              </>
            ) : <ErrCard />}
          </div>
        </div>
      )}

      {/* ═══ 2 · Risk plane · V × R ═══ */}
      <div className="mod" id="sg-vr">
        <div className="modh">
          <h3><i className="ti ti-chart-scatter" /> <span className="gloss" title="Cinecodex — the second objective axis beside Standing. Never blended with external signals or the canon.">Risk plane</span> · V × R</h3>
          <span className="meta">full collection · V ↑ · R →</span>
        </div>
        <div className="modbody">
          {data.collection == null ? <ErrCard /> : vrPts.length ? (
            <div className="sg-scatterwrap">
              <div className="sg-plane">
                <RiskPlaneSVG
                  pts={vrPts}
                  centroid={vBar != null && rBar != null ? { x: vrX(rBar), y: vrY(vBar) } : null}
                  selected={selDot}
                  xTicks={[0, 15, 30, 45, 60]} yTicks={[30, 50, 70, 90]}
                  xToPx={vrX} yToPx={vrY}
                  xMid={vrX(28)} yMid={vrY(70)}
                  onDot={openFilm} onCentroid={openCentroid}
                />
              </div>
              <div className="sg-side">
                <div className="sg-lead2"><i className="ti ti-info-circle" /><div>
                  Upper-left <b className="ideal">high V · low R = ideal</b> — gives a lot back, rarely lets you down.
                  Right side <b className="riskw">high R = divisive</b>. Hover or select a dot to see its title.
                </div></div>
                <div className="sg-grp">My portfolio · μ–σ</div>
                <div className="sg-stat"><span className="k">Mean earned value V̄</span><span className="v ok">{vBar != null ? vBar.toFixed(1) : "—"}</span></div>
                <div className="sg-stat"><span className="k">Mean risk R̄</span><span className="v rk">{rBar != null ? rBar.toFixed(1) : "—"}</span></div>
                <div className="sg-stat"><span className="k">Risk std dev σR</span><span className="v">{rBar != null ? rSd.toFixed(1) : "—"}</span></div>
                <div className="sg-stat"><span className="k">Ideal zone</span><span className="v ok">{idealCount} / {scored.length}</span></div>
                <div className="sg-stat"><span className="k">Divisive (R ≥ 28)</span><span className="v rk">{riskCount}</span></div>
                <div className="sg-legend">
                  <div className="lg"><i className="mine" />holdings (low–mid risk)</div>
                  <div className="lg"><i className="ideald" />ideal (high V · low R)</div>
                  <div className="lg"><i className="riskd" />divisive / high risk</div>
                  <div className="lg"><i className="avg" />your mean (centroid)</div>
                </div>
                <div className="sg-note">Dots = measured Cinecodex (R, V). Risk color <b>--risk</b> is distinct from the brand red. Click → full breakdown.</div>
              </div>
            </div>
          ) : (
            <div className="sg-empty">No Cinecodex-scored holdings yet — scored films appear as dots on the risk plane.</div>
          )}
          <div className="sg-formula">
            V = (COG+AFF+FORM+MORAL+DUR)/5 · R = 0.6·(bankruptcy, insincerity, cowardice) + 0.4·divisiveness.
            Standing and external signals are <b>not inputs</b> (one-way, never blended).
          </div>
        </div>
      </div>

      {/* ═══ 3 · Figure cloud ═══ */}
      <div className="mod" id="sg-cloud">
        <div className="modh">
          <h3><i className="ti ti-eye" /> Figure cloud <span style={{ color: "var(--faint)", fontWeight: 400 }}>· what crosses your films</span></h3>
          <span className="meta">figure types ∼ seen films · frequency-weighted</span>
        </div>
        <div className="modbody">
          {data.figures == null ? <ErrCard /> : data.figures.length ? (() => {
            const maxN = Math.max(...data.figures!.map((f) => f.n));
            return (
              <>
                <div className="sg-cloud">
                  {data.figures!.map((f) => {
                    const size = 10.5 + (f.n / maxN) * 5.5;
                    return (
                      <Link key={f.slug} className="sg-fc" href={`/trope/${f.slug}`} style={{ fontSize: size, opacity: f.n === 1 ? 0.72 : 1 }} title={`${f.label} · ${f.n} films`}>
                        {f.label}<b>{f.n}</b>
                      </Link>
                    );
                  })}
                </div>
                <div className="sg-note" style={{ fontStyle: "italic" }}>
                  The thickest line runs through <b style={{ color: "#c6bcf7" }}>&ldquo;{data.figures![0].label}&rdquo;</b> ({data.figures![0].n} films) — a repetition you may not have noticed. Size = frequency across your seen films.
                </div>
              </>
            );
          })() : (
            <div className="sg-empty">No recurring figures yet — watch more films and the shapes that cross them surface here.</div>
          )}
        </div>
      </div>

      {/* ═══ 4 · Theory teaser — one line, full profile lives in Lens ═══ */}
      <TheoryTeaser />

      {/* ═══ 5 · Kindred films ═══ */}
      <div className="mod" id="sg-kindred">
        <div className="modh">
          <h3><i className="ti ti-affiliate" /> Kindred films <span style={{ color: "var(--faint)", fontWeight: 400 }}>· nearest unseen</span></h3>
          <span className="meta">sim = cosine similarity to your loved centroid</span>
        </div>
        <div className="modbody">
          {data.neighbors == null ? <ErrCard /> : kindred.length ? (
            <>
              {kindred.map((n, i) => {
                const simPct = n.sim != null ? Math.round(n.sim * 100) : 0;
                const kept = session.kept.has(n.slug);
                return (
                  <div key={n.slug} className="sg-rrow" role="button" tabIndex={0} onClick={() => openNeighbor(n)} onKeyDown={onKey(() => openNeighbor(n))}>
                    <div className="sg-rk">{i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="sg-rt">{n.title}</div>
                      <div className="sg-rsub">{n.year ?? "?"}{n.director ? ` · ${n.director}` : ""}{kept ? " · Kept" : ""}</div>
                    </div>
                    <div className="sg-barwrap"><div className="track"><i style={{ width: `${simPct}%` }} /></div><span className="pct">{simPct}%</span></div>
                    <div className="sg-sim"><div className="pv">{simPct}</div><div className="pl">SIM</div></div>
                    <div className="sg-ract" onClick={(e) => e.stopPropagation()}>
                      <span className={`fb${kept ? " done" : ""}`} title={STR.row.keep} role="button" tabIndex={0}
                        onClick={() => { void doKeep(n.slug, n.title); }} onKeyDown={onKey(() => { void doKeep(n.slug, n.title); })}>
                        <i className="ti ti-bookmark-plus" />
                      </span>
                      <span className="fb" title={STR.row.seen} role="button" tabIndex={0}
                        onClick={() => { void doSeen(n.slug, n.title); }} onKeyDown={onKey(() => { void doSeen(n.slug, n.title); })}>
                        <i className="ti ti-check" />
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="sg-note" style={{ fontStyle: "italic" }}>
                The nearest <b>unseen</b> films to your loved-film centroid. Click a row for similarity · V·R · why; Keep queues it on your slate.
              </div>
            </>
          ) : (
            <div className="sg-empty">Kindred films appear once 3+ of your rated films (★3.5+) carry taste vectors — rate more films.</div>
          )}
        </div>
      </div>

      {/* ═══ 6 · Framework fingerprint ═══ */}
      <div className="mod" id="sg-fw">
        <div className="modh">
          <h3><i className="ti ti-chart-bar" /> Framework fingerprint</h3>
          <span className="meta">14 Strong Misreadings · films with a published reading</span>
        </div>
        <div className="modbody">
          {data.breakdown == null ? <ErrCard /> : fwBars.length ? (
            <>
              {fwBars.map((b) => (
                <div className="sg-comp" key={b.key}>
                  <span className="cl" title={b.def.short || b.key}>{b.def.label}</span>
                  <div className="ct"><i style={{ width: `${Math.round((b.n / fwMax) * 100)}%`, background: b.def.color }} /></div>
                  <span className="cv">{b.n}</span>
                </div>
              ))}
              <div className="sg-note">Which of the 14 frames your films attract — count = seen films with at least one published reading in that frame. Not a score.</div>
            </>
          ) : (
            <div className="sg-empty">No framework distribution yet — published readings on your seen films draw this fingerprint.</div>
          )}
        </div>
      </div>
    </div>
  );
}
