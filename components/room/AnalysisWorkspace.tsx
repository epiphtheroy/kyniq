"use client";
/** 자산 분석 워크벤치 (The Room · /room/analysis).
 *  Ported from mockup-me-analysis-v2.html — REAL data via Supabase RPCs:
 *   - me_taste_signature  → 취향 시그니처 (anchors + lineages)
 *   - portfolio_breakdown → framework/lens bars + canon(축 커버리지)
 *   - me_collection       → 두 개의 산점도 (Prestige×Discovery, V×R μ–σ)
 *   - me_figure_cloud     → 반복 형상 클라우드
 *   - me_taste_neighbors  → 상호추천 (nearest unseen w/ sim)
 *  Scatter plots hand-rolled as inline SVG (no chart libs), mirroring EvalCard's donuts.
 *  Inspector-swap mirrors CollectionWorkspace (setDefault in useEffect, insp.select on click). */
import { useMemo, useEffect, type ReactNode } from "react";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

/* ── typed RPC rows (numerics arrive as strings from PostgREST) ── */
export type SigRow = { kind: string; label: string; films: number };
export type CollRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null; v: number | string | null; c: number | string | null;
  r: number | string | null; u: number | null; prestige: number | string | null;
  discovery: number | string | null; conf: number | null; tier: string | null;
  imdb: number | string | null; rt: number | null; meta: number | null; votes: number | null;
};
export type NeighborRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null; sim: number | string | null;
};
export type FigureRow = { label: string; slug: string; n: number; maturity: string | null };
export type Breakdown = {
  watched?: number; watchlist?: number; avg_rating?: number;
  framework?: Record<string, number>;
  canon?: { label: string; seen: number; total: number }[];
} | null;
/* 엔진⑦ me_coverage — 축 커버리지 실측 (전 facet) */
export type CovRow = {
  list_id: string; slug: string; label: string; facet: string; aw: number | string | null;
  seen: number; total: number; pct: number; state: string;
};

export type AnalysisData = {
  signature: SigRow[];
  breakdown: Breakdown;
  collection: CollRow[];
  figures: FigureRow[];
  neighbors: NeighborRow[];
  coverage: CovRow[];
};

const IMG = "https://image.tmdb.org/t/p/w92";
const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);
const r0 = (x: number | null) => (x == null ? null : Math.round(x));

/* ═══════════ inspector nodes ═══════════ */

/** Film Cinecodex summary (dots → inspector). me_collection lacks per-film imdb/rt/meta in scatter
 *  rows for neighbors, but full collection rows carry them; pass what we have. */
function FilmInsp({ f }: { f: { slug: string; title: string; year: number | null; director: string | null; poster_path: string | null; v: number | null; c: number | null; r: number | null; u: number | null; prestige: number | null; discovery: number | null; conf: number | null; tier: string | null; imdb: number | null; rt: number | null; meta: number | null; votes: number | null; rating: number | null } }) {
  const rp = f.rating != null ? Math.round(f.rating * 20) : null;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div><div className="seltitle ser">{f.title}</div><div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div></div>
      </div>
      <div className="icard"><h4><i className="ti ti-building-bank" /> 정전가 · 시장가</h4>
        <div className="bigscore">{f.prestige != null ? Math.round(f.prestige) : "—"}</div>
        <div className="kv"><span>Discovery (숨은가치)</span><b>{f.discovery != null ? Math.round(f.discovery) : "—"}</b></div>
        <div className="kv"><span>내 별점</span><b>{f.rating != null ? f.rating.toFixed(1) : "—"}</b></div>
      </div>
      <CinecodexCard d={{ v: f.v, c: f.c, r: f.r, u: f.u, prestige: f.prestige, conf: f.conf, tier: f.tier, imdb: f.imdb, rt: f.rt, meta: f.meta, votes: f.votes, ratingPct: rp }} showBadge slug={f.slug} />
    </div>
  );
}

/** Neighbor (unseen recommendation) inspector card. */
function NeighborInsp({ n }: { n: { slug: string; title: string; year: number | null; director: string | null; poster_path: string | null; v: number | null; r: number | null; prestige: number | null; sim: number | null } }) {
  const simPct = n.sim != null ? Math.round(n.sim * 100) : null;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={n.poster_path ? { backgroundImage: `url(${IMG}${n.poster_path})` } : {}} />
        <div><div className="seltitle ser">{n.title}</div><div className="selsub">{n.year ?? "?"}{n.director ? ` · ${n.director}` : ""} · 미관람 추천</div></div>
      </div>
      <div className="icard"><h4><i className="ti ti-affiliate" /> 상호추천 · 취향 근접</h4>
        <div className="bigscore" style={{ color: "var(--reading)" }}>{simPct != null ? `${simPct}` : "—"}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 6 }}>/ 100 유사도</span></div>
        <div className="kv"><span>V 획득가치</span><b>{n.v != null ? Math.round(n.v) : "—"}</b></div>
        <div className="kv"><span>R 위험 (--risk)</span><b style={{ color: n.r != null && n.r >= 28 ? "var(--risk)" : "var(--ink)" }}>{n.r != null ? Math.round(n.r) : "—"}</b></div>
        <div className="kv"><span>정전가 (시장가)</span><b>{n.prestige != null ? Math.round(n.prestige) : "—"}</b></div>
      </div>
      <div className="icard"><h4><i className="ti ti-info-circle" /> 왜 끌려왔나</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          당신의 loved 취향 중심(centroid)과 코사인 유사도 <b style={{ color: "var(--reading)" }}>{n.sim != null ? n.sim.toFixed(3) : "—"}</b> — 아직 안 본 영화 중 가장 가까운 축. V·R은 Cinecodex 펀더멘털(정전가·외부지표와 안 섞음).
        </div>
        <div className="actbar" style={{ marginTop: 10 }}><a href={`/room/film/${n.slug}`} className="actbtn pri" style={{ display: "block", textAlign: "center" }}>영화 카드 보기 →</a></div>
      </div>
    </div>
  );
}

/* ═══════════ scatter geometry ═══════════ */
type Pt = { slug: string; title: string; x: number; y: number; kind: "mine" | "ideal" | "risk" | "op" };

function ScatterSVG({
  viewW, viewH, pts, centroid, xlab, ylab, xTicks, yTicks, xToPx, yToPx, shade, quadLabels, onDot, onCentroid,
}: {
  viewW: number; viewH: number;
  pts: Pt[]; centroid: { x: number; y: number; label: string } | null;
  xlab: string; ylab: string;
  xTicks: number[]; yTicks: number[];
  xToPx: (v: number) => number; yToPx: (v: number) => number;
  shade: { x: number; y: number; w: number; h: number; fill: string }[];
  quadLabels: { x: number; y: number; text: string; fill: string; anchor: "start" | "end" }[];
  onDot: (slug: string) => void; onCentroid: () => void;
}) {
  const X0 = 54, X1 = viewW - 40, Y0 = 26, Y1 = viewH - 42;
  return (
    <svg className="an-scatter" viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label={`${ylab} × ${xlab} 산점도`}>
      <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="#111114" stroke="#2c2c30" />
      {shade.map((s, i) => <rect key={`sh${i}`} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} />)}
      {/* y ticks */}
      {yTicks.map((v) => {
        const y = yToPx(v);
        return (
          <g key={`yt${v}`}>
            <line x1={X0 - 4} y1={y} x2={X0} y2={y} stroke="#3a3a40" />
            <text x={X0 - 8} y={y + 3} textAnchor="end" fontSize="8.5" fill="#6C6960">{v}</text>
          </g>
        );
      })}
      {/* x ticks */}
      {xTicks.map((v) => {
        const x = xToPx(v);
        return (
          <g key={`xt${v}`}>
            <line x1={x} y1={Y1} x2={x} y2={Y1 + 4} stroke="#3a3a40" />
            <text x={x} y={Y1 + 15} textAnchor="middle" fontSize="8.5" fill="#6C6960">{v}</text>
          </g>
        );
      })}
      <text x={(X0 + X1) / 2} y={Y1 + 29} textAnchor="middle" fontSize="9.5" fill="#9A968D">{xlab}</text>
      <text x="15" y={(Y0 + Y1) / 2} textAnchor="middle" fontSize="9.5" fill="#9A968D" transform={`rotate(-90 15 ${(Y0 + Y1) / 2})`}>{ylab}</text>
      {quadLabels.map((q, i) => (
        <text key={`q${i}`} x={q.x} y={q.y} textAnchor={q.anchor} className="an-quad" fill={q.fill}>{q.text}</text>
      ))}
      {/* dots */}
      {pts.map((p) => {
        const fill = p.kind === "ideal" ? "#5fd0b2" : p.kind === "risk" ? "var(--risk)" : p.kind === "op" ? "var(--frontier)" : "#ECEAE5";
        const stroke = p.kind === "risk" ? "#f0937a" : "none";
        const rr = p.kind === "ideal" ? 5.5 : 4.5;
        const nearRight = p.x > X1 - 90;
        return (
          <g key={p.slug} className="an-dot" onClick={() => onDot(p.slug)}>
            <title>{p.title}</title>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={rr} fill={fill} {...(stroke !== "none" ? { stroke, strokeWidth: 1 } : {})} />
            <text x={nearRight ? p.x - 8 : p.x + 8} y={p.y + 3} textAnchor={nearRight ? "end" : "start"} fontSize="8" fontFamily="PT Serif,serif"
              fill={p.kind === "risk" ? "#f0937a" : p.kind === "ideal" ? "#5fd0b2" : "#8b877e"}>{p.title}</text>
          </g>
        );
      })}
      {/* centroid diamond */}
      {centroid ? (
        <g className="an-dot" onClick={onCentroid}>
          <title>{centroid.label}</title>
          <circle cx={centroid.x} cy={centroid.y} r={16} fill="transparent" />
          <path d={`M${centroid.x} ${centroid.y - 6} L${centroid.x + 6} ${centroid.y} L${centroid.x} ${centroid.y + 6} L${centroid.x - 6} ${centroid.y} Z`}
            fill="var(--red)" stroke="#fff" strokeWidth="0.8" />
          <text x={centroid.x + 9} y={centroid.y - 6} fontSize="8.5" fill="#ECEAE5">{centroid.label}</text>
        </g>
      ) : null}
    </svg>
  );
}

/* ═══════════ main ═══════════ */
export default function AnalysisWorkspace({ data }: { data: AnalysisData }) {
  const insp = useInspector();
  const { setDefault } = insp;

  /* derive normalized collection with numeric coercion */
  const coll = useMemo(() =>
    data.collection.map((f) => ({
      slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
      rating: num(f.rating), v: num(f.v), c: num(f.c), r: num(f.r), u: f.u,
      prestige: num(f.prestige), discovery: num(f.discovery), conf: f.conf, tier: f.tier,
      imdb: num(f.imdb), rt: f.rt, meta: f.meta, votes: f.votes,
    })), [data.collection]);

  const neighbors = useMemo(() =>
    data.neighbors.map((n) => ({
      slug: n.slug, title: n.title, year: n.year, director: n.director, poster_path: n.poster_path,
      v: num(n.v), r: num(n.r), prestige: num(n.prestige), sim: num(n.sim),
    })), [data.neighbors]);

  /* signature split */
  const anchors = useMemo(() => data.signature.filter((s) => s.kind === "anchor"), [data.signature]);
  const lineages = useMemo(() => data.signature.filter((s) => s.kind === "lineage"), [data.signature]);

  /* framework/lens bars from breakdown (top by count) */
  const fw = data.breakdown?.framework ?? {};
  const fwMax = Math.max(1, ...Object.values(fw));
  const fwBars = useMemo(() =>
    Object.entries(fw).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n], i) => ({ k, n, pct: Math.round((n / fwMax) * 100), color: ["var(--reading)", "var(--canon)", "var(--safe)", "var(--frontier)", "var(--mut)"][i % 5] })),
    [fw, fwMax]);

  /* signature prose composed HONESTLY from real top anchor + top framework/lineage names */
  const topAnchor = anchors[0]?.label ?? null;
  const topAnchor2 = anchors[1]?.label ?? null;
  const topLineage = lineages[0]?.label ?? null;
  const topFw = fwBars[0]?.k ?? null;

  /* ── centroid (μ) for both scatters ── */
  const scored = coll.filter((f) => f.v != null && f.r != null);
  const withPd = coll.filter((f) => f.prestige != null && f.discovery != null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const sd = (xs: number[], m: number) => (xs.length ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) : 0);
  const vBar = mean(scored.map((f) => f.v!));
  const rBar = mean(scored.map((f) => f.r!));
  const rSd = rBar != null ? sd(scored.map((f) => f.r!), rBar) : 0;
  const preBar = mean(withPd.map((f) => f.prestige!));
  const disBar = mean(withPd.map((f) => f.discovery!));
  const idealCount = scored.filter((f) => f.v! >= 70 && f.r! <= 25).length;
  const riskCount = scored.filter((f) => f.r! >= 28).length;

  /* ── V×R (μ–σ) scatter geometry: R→x (0..RMAX), V→y (VMIN..VMAX flipped) ── */
  const VR_W = 560, VR_H = 340;
  const VR_X0 = 54, VR_X1 = VR_W - 40, VR_Y0 = 26, VR_Y1 = VR_H - 42;
  const rMax = Math.max(60, ...scored.map((f) => f.r!), rBar ?? 0);
  const vMin = 30, vMax = 100;
  const vrX = (r: number) => VR_X0 + (Math.max(0, Math.min(rMax, r)) / rMax) * (VR_X1 - VR_X0);
  const vrY = (v: number) => VR_Y1 - ((Math.max(vMin, Math.min(vMax, v)) - vMin) / (vMax - vMin)) * (VR_Y1 - VR_Y0);
  const vrPts: Pt[] = scored.map((f) => ({
    slug: f.slug, title: f.title, x: vrX(f.r!), y: vrY(f.v!),
    kind: f.v! >= 70 && f.r! <= 25 ? "ideal" : f.r! >= 28 ? "risk" : "mine",
  }));
  const vrXMid = vrX(28), vrYMid = vrY(70);

  /* ── Prestige×Discovery scatter: Prestige→x, Discovery→y ── */
  const PD_W = 560, PD_H = 300;
  const PD_X0 = 54, PD_X1 = PD_W - 40, PD_Y0 = 26, PD_Y1 = PD_H - 42;
  const pdX = (p: number) => PD_X0 + (Math.max(0, Math.min(100, p)) / 100) * (PD_X1 - PD_X0);
  const pdY = (d: number) => PD_Y1 - (Math.max(0, Math.min(100, d)) / 100) * (PD_Y1 - PD_Y0);
  const pdPts: Pt[] = withPd.map((f) => ({
    slug: f.slug, title: f.title, x: pdX(f.prestige!), y: pdY(f.discovery!),
    kind: f.prestige! <= 50 && f.discovery! >= 50 ? "op" : "mine",
  }));

  const findColl = (slug: string) => coll.find((f) => f.slug === slug) ?? null;

  /* ── default inspector = 취향 시그니처 stack (mirrors CollectionWorkspace setDefault) ── */
  useEffect(() => {
    const prose: ReactNode = topAnchor ? (
      <>
        당신의 영화들을 가로지르는 가장 굵은 선은 <b>「{topAnchor}」</b>
        {topAnchor2 ? <> 과 <b>「{topAnchor2}」</b></> : null}
        입니다. 렌즈는 주로 <b>{topFw ?? "—"}</b> 프레임으로 읽고, 가장 두꺼운 계보는 <b>{topLineage ?? "—"}</b>. 장르가 아니라 <b>보는 방식</b>이 시그니처입니다.
      </>
    ) : (<>아직 loved(★4.5+) 표본이 적어 시그니처가 형성 중입니다. 영화를 더 평가하면 반복되는 해석 앵커가 떠오릅니다.</>);

    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-fingerprint" /> 취향 시그니처</h4>
          <div style={{ fontSize: 13, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>{prose}</div>
          {anchors.length ? (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {anchors.slice(0, 6).map((a) => <span key={a.label} className="an-chip">{a.label} <span style={{ color: "var(--sub)" }}>{a.films}</span></span>)}
            </div>
          ) : null}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>앵커 = figures ∼ figure_type ∼ loved(★4.5+) 상위 · 장르가 아닌 해석층.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-chart-dots" /> 포트폴리오 · μ–σ</h4>
          <div className="kv"><span>보유(관람)</span><b>{data.breakdown?.watched ?? coll.length}</b></div>
          <div className="kv"><span>Cinecodex 평가됨</span><b>{scored.length}</b></div>
          <div className="kv"><span>평균 획득가치 V̄</span><b style={{ color: "#5fd0b2" }}>{r0(vBar) ?? "—"}</b></div>
          <div className="kv"><span>평균 위험 R̄ (--risk)</span><b style={{ color: "var(--risk)" }}>{r0(rBar) ?? "—"}</b></div>
        </div>
        <div className="an-empty" style={{ textAlign: "left", padding: "0 2px" }}>산점도의 점 · 계보 · 추천을 클릭하면 여기에 상세 · 왜가 열립니다.</div>
      </div>
    );
  }, [data, coll, scored.length, anchors, lineages, topAnchor, topAnchor2, topFw, topLineage, vBar, rBar, setDefault]);

  const openFilm = (slug: string) => { const f = findColl(slug); if (f) insp.select(<FilmInsp f={f} />, `${f.title} · Cinecodex`); };
  const openNeighbor = (n: (typeof neighbors)[number]) => insp.select(<NeighborInsp n={n} />, `${n.title} · 추천`);
  const openCentroid = () => insp.select(
    <div>
      <div className="icard"><h4><i className="ti ti-crosshair" /> 내 포트폴리오 평균 · μ–σ</h4>
        <div className="bigscore" style={{ color: "var(--red)" }}>V̄ {r0(vBar) ?? "—"}<span style={{ fontSize: 13, color: "var(--sub)", marginLeft: 8 }}>· R̄ {r0(rBar) ?? "—"}</span></div>
        <div className="crow" style={{ marginTop: 8 }}><span className="cl">평균 V̄</span><div className="cbar"><i style={{ width: `${Math.min(100, vBar ?? 0)}%`, background: "#5fd0b2" }} /></div><span className="cvv">{r0(vBar) ?? "—"}</span></div>
        <div className="crow"><span className="cl">평균 R̄</span><div className="cbar"><i style={{ width: `${Math.min(100, ((rBar ?? 0) / rMax) * 100)}%`, background: "var(--risk)" }} /></div><span className="cvv">{r0(rBar) ?? "—"}</span></div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 9, lineHeight: 1.55 }}>
          위험 표준편차 σ<sub>R</sub> <b style={{ color: "var(--ink)" }}>{rBar != null ? rSd.toFixed(1) : "—"}</b> · 이상향(좌상 고V·저R) <b style={{ color: "#5fd0b2" }}>{idealCount}</b>편 · 분열/고위험(R≥28) <b style={{ color: "var(--risk)" }}>{riskCount}</b>편. 좌상이 이상향, 우측은 분열 위험.
        </div>
      </div>
    </div>, "내 평균 · μ–σ");

  const watched = data.breakdown?.watched ?? coll.length;
  /* 엔진⑦ me_coverage 실측 rows — facet 라벨 포함 (portfolio_breakdown.canon 파생 제거) */
  const FACET_KO: Record<string, string> = { canon: "정전", award: "수상", national: "국가", auteur: "감독" };
  const covRows = data.coverage.map((c) => ({
    label: c.label, facet: c.facet, facetKo: FACET_KO[c.facet] ?? c.facet,
    seen: c.seen, total: c.total, pct: c.pct,
  }));

  return (
    <div className="mainpad">
      <h1 className="secttl">자산 분석 · 워크벤치</h1>
      <p className="secsub">
        당신의 <span className="gloss" title="loved(★4.5+) 영화들의 평균 취향 벡터">취향 벡터</span>를 소비해 계보 관련성 · 축 커버리지 · 상호추천 · 해석 앵커로 펼칩니다. Cinecodex(V·R)는 정전가·외부지표와 <b style={{ fontStyle: "normal", color: "var(--mut)" }}>절대 안 섞음</b>(나란히).
      </p>

      {/* ═══ HERO · 취향 시그니처 ═══ */}
      <div className="an-hero">
        <div className="an-navbig">
          <div className="an-ring">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
              {(() => { const C = 2 * Math.PI * 38; const frac = Math.min(1, watched / 50); return (
                <circle cx="46" cy="46" r="38" fill="none" stroke="var(--reading)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - frac)).toFixed(1)} transform="rotate(-90 46 46)" />
              ); })()}
              <text x="46" y="44" textAnchor="middle" fontSize="15" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{watched}</text>
              <text x="46" y="58" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1">편 학습</text>
            </svg>
          </div>
          <div className="an-navmeta">
            <div className="eb">취향 시그니처 · Taste Vector</div>
            <div className="an-lvl">● {topAnchor ? topAnchor : "형성 중"}</div>
            <div className="an-pctl">앵커 <b>{anchors.length}</b> · 관련 계보 <b>{lineages.length}</b> · 평균 별점 <b>{data.breakdown?.avg_rating ?? "—"}</b></div>
          </div>
        </div>
        <div className="an-components">
          {fwBars.length ? fwBars.map((b) => (
            <div className="an-comp" key={b.k}>
              <span className="cl" title={b.k}>{b.k}</span>
              <div className="ct"><i style={{ width: `${b.pct}%`, background: b.color }} /></div>
              <span className="cv">{b.n}</span>
            </div>
          )) : <div className="an-empty" style={{ textAlign: "left" }}>렌즈 프레임 분포가 아직 없습니다.</div>}
        </div>
        <div className="an-sig-prose">
          {topAnchor ? (
            <>당신을 한 문장으로: 반복해 <span className="em">「{topAnchor}」</span>를 보는 사람.{topLineage ? <> 가장 두꺼운 계보는 <b>{topLineage}</b>이고, 렌즈는 <b>{topFw ?? "—"}</b> 프레임으로 읽습니다.</> : null}</>
          ) : (<>아직 loved(★4.5+) 표본이 적어 시그니처 문장을 만들 수 없습니다 — 더 평가하면 반복 앵커가 떠오릅니다.</>)}
        </div>
        {anchors.length ? (
          <div className="an-anchorchips">
            {anchors.map((a) => <span key={a.label} className="an-chip">{a.label} <span style={{ color: "var(--sub)" }}>{a.films}</span></span>)}
          </div>
        ) : null}
        <div className="an-foot"><i className="ti ti-function" style={{ color: "var(--canon)" }} /> 앵커 = <b>figures ∼ figure_type_members ∼ loved(★4.5+)</b> 상위 · 계보 = <b>film_lineage ∼ loved</b> · 프레임 = 프레임워크별 관람 커버리지.</div>
      </div>

      {/* ═══ LEAD · 인사이트 요약 ═══ */}
      <div className="an-lead">
        <div className="an-lh"><i className="ti ti-bulb" /> 이번 분석이 알려주는 것</div>
        {topAnchor ? (
          <div className="an-leadrow">
            <div className="an-lic boost"><i className="ti ti-fingerprint" /></div>
            <div className="an-lt">당신의 해석 시그니처는 <span className="rd">「{topAnchor}」</span>{topAnchor2 ? <> · <span className="rd">「{topAnchor2}」</span></> : null} — 여러 영화를 가로지르는 반복 형상. 장르가 아니라 <b>보는 방식</b>입니다.</div>
          </div>
        ) : null}
        {vBar != null && rBar != null ? (
          <div className="an-leadrow">
            <div className="an-lic risk"><i className="ti ti-alert-triangle" /></div>
            <div className="an-lt"><b style={{ color: "var(--an-risktx)" }}>μ–σ 위험평면</b> · 내 포트폴리오 평균 획득가치 <b>V̄ {r0(vBar)}</b> · <span className="riskw">평균 위험 R̄ {r0(rBar)}</span>. 이상향(좌상 고V·저R) <b>{idealCount}편</b>, 분열/고위험(R≥28) <b className="riskw">{riskCount}편</b>.</div>
          </div>
        ) : null}
        {covRows.length ? (() => {
          const lowest = [...covRows].sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
          return (
            <div className="an-leadrow">
              <div className="an-lic blind"><i className="ti ti-eye-off" /></div>
              <div className="an-lt">가장 얕은 축은 <span className="gapw">{lowest.label} ({lowest.pct}%)</span> — {lowest.facetKo} 계보 · {lowest.seen}/{lowest.total}편. 채울 가치가 가장 큰 계보입니다.</div>
            </div>
          );
        })() : null}
        {neighbors.length ? (
          <div className="an-leadrow clk" onClick={() => openNeighbor(neighbors[0])}>
            <div className="an-lic move"><i className="ti ti-affiliate" /></div>
            <div className="an-lt">지금 가장 가까운 미관람작은 <span className="drift">{neighbors[0].title}</span> (유사도 {neighbors[0].sim != null ? Math.round(neighbors[0].sim * 100) : "—"}%) — 취향 중심에 가장 근접한 다음 한 편.</div>
          </div>
        ) : null}
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div className="an-kpis">
        <div className="an-kpi"><div className="eb">학습 표본</div><div className="v">{watched}<small>편</small></div><div className="d">관람 자산</div></div>
        <div className="an-kpi"><div className="eb">Cinecodex 평가</div><div className="v">{scored.length}</div><div className="d">V·R 실측</div></div>
        <div className="an-kpi"><div className="eb">해석 앵커</div><div className="v">{anchors.length}</div><div className="d an-up">반복 형상</div></div>
        <div className="an-kpi"><div className="eb">관련 계보</div><div className="v">{lineages.length}</div><div className="d">loved ∼ lineage</div></div>
        <div className="an-kpi"><div className="eb">이상향(좌상)</div><div className="v">{idealCount}<small>/{scored.length}</small></div><div className="d">고V · 저R</div></div>
      </div>

      {/* ═══ (1) 렌즈 분포 · Prestige × Discovery ═══ */}
      <div className="mod" id="an-pd">
        <div className="modh"><h3><i className="ti ti-chart-dots" /> 렌즈 분포 · Prestige × Discovery <span style={{ color: "var(--faint)", fontWeight: 400 }}>①</span></h3>
          <span className="meta">prestige = 시장가 · discovery = 숨은가치</span></div>
        <div className="modbody">
          {pdPts.length ? (
            <div className="an-scatterwrap">
              <div className="an-plane">
                <ScatterSVG
                  viewW={PD_W} viewH={PD_H} pts={pdPts}
                  centroid={preBar != null && disBar != null ? { x: pdX(preBar), y: pdY(disBar), label: "당신 평균" } : null}
                  xlab="PRESTIGE 정전가 →" ylab="DISCOVERY 숨은가치 ↑"
                  xTicks={[0, 25, 50, 75, 100]} yTicks={[0, 25, 50, 75, 100]}
                  xToPx={pdX} yToPx={pdY}
                  shade={[{ x: PD_X0, y: PD_Y0, w: pdX(50) - PD_X0, h: pdY(50) - PD_Y0, fill: "rgba(62,143,224,.06)" }]}
                  quadLabels={[{ x: PD_X0 + 8, y: PD_Y0 + 14, text: "좌상 · 저권위·고발굴 = 기회 구역", fill: "#86b9ec", anchor: "start" }]}
                  onDot={openFilm} onCentroid={openCentroid}
                />
              </div>
              <div className="an-side">
                <div className="an-lead2 op"><i className="ti ti-info-circle" /><div>좌상 <b className="ideal">저권위·고발굴 = 기회 구역</b>(발굴↑). 우상 고권위는 정전 추종. 좌상으로 이동할수록 Discovery↑·다양성↑.</div></div>
                <div className="an-grp">내 포트폴리오 · 평균</div>
                <div className="an-stat"><span className="k">평균 정전가</span><span className="v">{r0(preBar) ?? "—"}</span></div>
                <div className="an-stat"><span className="k">평균 숨은가치</span><span className="v ok">{r0(disBar) ?? "—"}</span></div>
                <div className="an-stat"><span className="k">플롯 편수</span><span className="v">{pdPts.length}</span></div>
                <div className="an-legend">
                  <div className="lg"><i className="mine" />보유 영화</div>
                  <div className="lg"><i className="opd" />기회 구역 (저권위·고발굴)</div>
                  <div className="lg"><i className="avg" />당신 평균 (centroid)</div>
                </div>
                <div className="an-note">점 = 실측 (정전가, discovery). 클릭 → Cinecodex 분해.</div>
              </div>
            </div>
          ) : <div className="an-empty">정전가·발굴 값이 있는 보유작이 아직 없습니다. 영화를 평가하면 여기에 렌즈 분포가 그려집니다.</div>}
        </div>
      </div>

      {/* ═══ (2) μ–σ 위험평면 · V × R ═══ */}
      <div className="mod" id="an-vr">
        <div className="modh"><h3><i className="ti ti-chart-scatter" /> <span className="gloss" title="Cinecodex(엔진 ⑨) — 정전가 옆에 서는 두 번째 객관 점수. 외부·정전가와 안 섞음.">μ–σ 위험평면</span> · V × R <span style={{ color: "var(--faint)", fontWeight: 400 }}>⑨</span></h3>
          <span className="meta">V 획득가치 ↑ · R 위험 → · 정전가·외부와 안 섞음</span></div>
        <div className="modbody">
          {vrPts.length ? (
            <div className="an-scatterwrap">
              <div className="an-plane">
                <ScatterSVG
                  viewW={VR_W} viewH={VR_H} pts={vrPts}
                  centroid={vBar != null && rBar != null ? { x: vrX(rBar), y: vrY(vBar), label: "당신 평균" } : null}
                  xlab="R 위험 →" ylab="V 획득가치 ↑"
                  xTicks={[0, 15, 30, 45, 60]} yTicks={[30, 50, 70, 90]}
                  xToPx={vrX} yToPx={vrY}
                  shade={[
                    { x: VR_X0, y: VR_Y0, w: vrXMid - VR_X0, h: vrYMid - VR_Y0, fill: "rgba(31,178,134,.05)" },
                    { x: vrXMid, y: VR_Y0, w: VR_X1 - vrXMid, h: VR_Y1 - VR_Y0, fill: "rgba(214,69,24,.055)" },
                  ]}
                  quadLabels={[
                    { x: VR_X0 + 8, y: VR_Y0 + 14, text: "좌상 · 고V·저R = 이상향", fill: "#5fd0b2", anchor: "start" },
                    { x: VR_X1 - 8, y: VR_Y0 + 14, text: "우측 · 고R = 위험/분열", fill: "#f0937a", anchor: "end" },
                  ]}
                  onDot={openFilm} onCentroid={openCentroid}
                />
              </div>
              <div className="an-side">
                <div className="an-lead2"><i className="ti ti-info-circle" /><div>좌상 <b className="ideal">고V·저R = 이상향</b> — 많이 돌려주고 실망 위험이 낮다. 우측 <b className="riskw">고R = 위험/분열</b>. 저위험 고가치가 이상향.</div></div>
                <div className="an-grp">내 포트폴리오 · μ–σ</div>
                <div className="an-stat"><span className="k">평균 획득가치 V̄</span><span className="v ok">{vBar != null ? vBar.toFixed(1) : "—"}</span></div>
                <div className="an-stat"><span className="k">평균 위험 R̄</span><span className="v rk">{rBar != null ? rBar.toFixed(1) : "—"}</span></div>
                <div className="an-stat"><span className="k">위험 표준편차 σ<sub>R</sub></span><span className="v">{rBar != null ? rSd.toFixed(1) : "—"}</span></div>
                <div className="an-stat"><span className="k">이상향(좌상) 편수</span><span className="v ok">{idealCount} / {scored.length}</span></div>
                <div className="an-stat"><span className="k">분열작(R≥28)</span><span className="v rk">{riskCount}편</span></div>
                <div className="an-legend">
                  <div className="lg"><i className="mine" />보유 (저·중 위험)</div>
                  <div className="lg"><i className="ideald" />이상향 (고V·저R)</div>
                  <div className="lg"><i className="riskd" />분열·고위험 (R↑)</div>
                  <div className="lg"><i className="avg" />내 평균 (centroid)</div>
                </div>
                <div className="an-note">점 = 실측 Cinecodex (R,V). 위험색 <b style={{ color: "var(--an-risktx)" }}>--risk</b>는 완파 빨강과 별개. 클릭 → V/C/R 분해.</div>
              </div>
            </div>
          ) : <div className="an-empty">Cinecodex(V·R) 평가된 보유작이 아직 없습니다. 평가되면 위험평면에 점으로 나타납니다.</div>}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9, fontStyle: "italic" }}>V=(COG+AFF+FORM+MORAL+DUR)/5 · R=0.6·(파산·불성실·비겁)+0.4·분열성. 정전가·외부지표는 <b style={{ color: "var(--mut)", fontStyle: "normal" }}>입력 아님</b>(비섞임 단방향).</div>
        </div>
      </div>

      {/* ═══ (3) 반복 형상 클라우드 ═══ */}
      <div className="mod" id="an-cloud">
        <div className="modh"><h3><i className="ti ti-eye" /> 반복 형상 클라우드 <span style={{ color: "var(--faint)", fontWeight: 400 }}>· 내 영화를 가로지르는 것</span></h3>
          <span className="meta">figure_type ∼ 관람작 · 빈도 가중</span></div>
        <div className="modbody">
          {data.figures.length ? (() => {
            const maxN = Math.max(...data.figures.map((f) => f.n));
            return (
              <>
                <div className="an-cloud">
                  {data.figures.map((f) => {
                    const size = 10.5 + (f.n / maxN) * 5.5;
                    const opacity = f.n === 1 ? 0.72 : 1;
                    return (
                      <a key={f.slug} className="an-fc" href={`/trope/${f.slug}`} style={{ fontSize: size, opacity }} title={`${f.label} · ${f.n}편`}>
                        {f.label}<b>{f.n}</b>
                      </a>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, fontStyle: "italic" }}>
                  가장 굵은 선은 <b style={{ color: "#c6bcf7", fontStyle: "normal" }}>「{data.figures[0].label}」</b>({data.figures[0].n}편)에 흐릅니다 — 미처 의식 못한 반복. 크기 = 관람작 내 빈도.
                </div>
              </>
            );
          })() : <div className="an-empty">아직 반복되는 형상이 잡히지 않았습니다. 영화를 더 관람하면 여러 작품을 가로지르는 형상이 클라우드로 떠오릅니다.</div>}
        </div>
      </div>

      {/* ═══ (4) 축 커버리지 · 계보 ═══ */}
      <div className="mod" id="an-axis">
        <div className="modh"><h3><i className="ti ti-layout-grid" /> 축 커버리지 · 계보 (전 facet) <span style={{ color: "var(--faint)", fontWeight: 400 }}>④⑦</span></h3>
          <span className="meta">me_coverage 실측 · 낮을수록 블라인드</span></div>
        <div className="modbody">
          {covRows.length ? (
            <>
              {[...covRows].sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, 16).map((c) => {
                const cls = c.pct >= 50 ? "hi" : c.pct >= 25 ? "mid" : "lo";
                return (
                  <div key={`${c.facet}-${c.label}`} className={`an-cov ${cls}`} title={`${c.label} — ${c.seen}/${c.total} (${c.facetKo})`}>
                    <div className="cn">{c.label} <span style={{ color: "var(--sub)", fontSize: 9.5 }}>{c.facetKo}</span></div>
                    <div className="track"><i style={{ width: `${Math.max(c.pct, c.pct > 0 ? 3 : 1)}%` }} /></div>
                    <div className="frac">{c.seen}/{c.total} · {c.pct}%</div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, fontStyle: "italic" }}>
                분모는 계보별 실제 등재 편수(전 facet 실측 · 상위 16 표시). 커버리지 낮은 계보(<b style={{ color: "var(--an-blindtx)", fontStyle: "normal" }}>블라인드</b>)가 채울 가치가 가장 큽니다.
              </div>
            </>
          ) : <div className="an-empty">계보 커버리지 데이터가 아직 없습니다. 관람 표본이 계보에 매칭되면 커버리지 바가 나타납니다.</div>}
        </div>
      </div>

      {/* ═══ (5) 상호추천 그래프 ═══ */}
      <div className="mod" id="an-mutual">
        <div className="modh"><h3><i className="ti ti-affiliate" /> 상호추천 · 취향 중심에 가까운 미관람작 <span style={{ color: "var(--faint)", fontWeight: 400 }}>⑥</span></h3>
          <span className="meta">nearest unseen · sim = 코사인 유사도</span></div>
        <div className="modbody">
          {neighbors.length ? (
            <>
              {neighbors.map((n, i) => {
                const simPct = n.sim != null ? Math.round(n.sim * 100) : 0;
                return (
                  <div key={n.slug} className="an-rrow" onClick={() => openNeighbor(n)}>
                    <div className="an-rk">{i + 1}</div>
                    <div>
                      <div className="an-rt">{n.title}</div>
                      <div className="an-rsub">{n.year ?? "?"}{n.director ? ` · ${n.director}` : ""} · 미관람 추천</div>
                      <div className="reasons">
                        <span className="rsn reading">sim {n.sim != null ? n.sim.toFixed(3) : "—"}</span>
                        {n.r != null ? <span className={`rsn ${n.r >= 28 ? "conquer" : "safe"}`}>R {Math.round(n.r)}</span> : null}
                        {n.v != null ? <span className="rsn safe">V {Math.round(n.v)}</span> : null}
                      </div>
                    </div>
                    <div className="an-barwrap"><div className="track"><i style={{ width: `${simPct}%` }} /></div><span className="pct">{simPct}%</span></div>
                    <div className="an-wwi"><div className="pv" style={{ color: "var(--reading)" }}>{simPct}</div><div className="pl">SIM</div></div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, fontStyle: "italic" }}>
                loved 취향 중심(centroid)과 코사인 유사도 상위 <b style={{ color: "var(--mut)", fontStyle: "normal" }}>미관람</b> 영화. 줄을 클릭하면 유사도 · V·R · 왜가 열립니다.
              </div>
            </>
          ) : <div className="an-empty">아직 상호추천을 낼 만큼 취향 벡터가 형성되지 않았습니다. 영화를 더 평가하면 가장 가까운 미관람작이 나타납니다.</div>}
        </div>
      </div>
    </div>
  );
}
