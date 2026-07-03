"use client";
/** 현황 커맨드센터 (The Room · /room root).
 *  Ported from mockup-me-command-center.html — REAL data via Supabase RPCs:
 *   - me_portfolio_nav    → NAV 히어로 (nav + breadth/prestige/depth/discovery decomposition)
 *   - portfolio_breakdown → 커버리지 매트릭스 (⑦, S4 완파 4-state) + 블라인드 (④, S2 amber) + KPI
 *   - me_recommend_wwi    → WWI 추천 데스크 (⑤, S1) + 오늘의 한 편 (최대 Δ)
 *   - me_taste_neighbors  → 별자리 (⑥, hand-rolled inline-SVG affinity map)
 *  Inspector-swap mirrors AnalysisWorkspace/CollectionWorkspace (setDefault in useEffect
 *  with [data,setDefault]-style deps; insp.select on click). PostgREST numerics arrive as
 *  strings → coerced with num() before any .toFixed()/+. */
import { useMemo, useEffect, type ReactNode } from "react";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

/* ── typed RPC shapes (numerics may arrive as strings from PostgREST) ── */
export type Nav = {
  nav: number | string | null;
  n_watched: number | string | null;
  n_scored: number | string | null;
  essentials: number | string | null;
  avg_standing: number | string | null;
  lines: number | string | null;
} | null;

export type Canon = { label: string; seen: number; total: number };
export type Breakdown = {
  watched?: number; watchlist?: number; avg_rating?: number | string | null;
  canon?: Canon[];
} | null;

/* 엔진⑦ me_coverage · 엔진④ me_blindspots — 전용 RPC 실측 rows */
export type CovRow = {
  list_id: string; slug: string; label: string; facet: string; aw: number | string | null;
  seen: number; total: number; pct: number; state: string;
};
export type BlindRow = {
  list_id: string; slug: string; label: string; facet: string; aw: number | string | null;
  seen: number; total: number; ratio: number | string | null;
  productivity: number | string | null; opportunity: number | string | null; gap_reason: string;
};

export type Avail = { state: string; provider?: string } | null;
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; ts: number | string | null;
  prestige: number | string | null; conf: number | string | null; tier: string | null;
  sim: number | string | null; u_util: number | string | null; t_taste: number | string | null;
  s_standing: number | string | null; wwi: number | string | null; disc: number | string | null;
  reasons: string[] | null; avail: Avail; delta: number | string | null; in_watchlist?: boolean | null;
};

export type NeighborRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null; sim: number | string | null;
};

export type CommandData = {
  nav: Nav;
  breakdown: Breakdown;
  recs: WwiRow[];
  neighbors: NeighborRow[];
  coverage: CovRow[];  // 엔진⑦ me_coverage — 전 facet 실측 분모
  blinds: BlindRow[];  // 엔진④ me_blindspots — 생산성 게이트 통과
  avgDiscovery: number | null; // computed server-side from me_collection() discovery avg
};

const IMG = "https://image.tmdb.org/t/p/w92";
const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);
const r0 = (x: number | null) => (x == null ? null : Math.round(x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* 6+가용 이유 정본 (engine ⑤ · MASTER-INDEX §4). blind = amber(gap形), conquer red 금지. */
const REASON_MAP: Record<string, { cls: string; label: string }> = {
  safe: { cls: "safe", label: "안전자산" },
  reading: { cls: "reading", label: "취향 적중" },
  canon: { cls: "canon", label: "정전 위상" },
  gap: { cls: "gap", label: "공백 충족" },
  frontier: { cls: "frontier", label: "안전한 모험" },
  conquer: { cls: "conquer", label: "도장깨기" },
};
function reasonChips(codes: string[] | null): { cls: string; label: string }[] {
  return (codes ?? ["frontier"]).slice(0, 3).map((c) => REASON_MAP[c] ?? { cls: "frontier", label: c });
}
function riskDotCls(r: number | null) { return r == null ? "" : r <= 15 ? "lo" : r <= 25 ? "mid" : ""; }

/* 커버리지 4-state (S4 완파): 잠금<50 · 진행50–74 · 근접75–99 · 완파100 */
function covState(pct: number): { cls: string; label: string; col: string } {
  if (pct >= 100) return { cls: "st-done", label: "완파", col: "var(--conquer)" };
  if (pct >= 75) return { cls: "st-near", label: "근접", col: "var(--canon)" };
  if (pct >= 50) return { cls: "st-prog", label: "진행", col: "var(--canon)" };
  return { cls: "st-lock", label: "잠금", col: "var(--sub)" };
}

/* ═══════════ derived normalizers ═══════════ */
type Rec = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; ts: number | null; prestige: number | null; conf: number | null;
  tier: string | null; sim: number | null; u_util: number | null; t_taste: number | null;
  s_standing: number | null; wwi: number | null; disc: number | null;
  reasons: string[] | null; avail: Avail; delta: number | null;
};
function normRec(f: WwiRow): Rec {
  return {
    slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, director: f.director,
    v: num(f.v), r: num(f.r), ts: num(f.ts), prestige: num(f.prestige), conf: num(f.conf),
    tier: f.tier, sim: num(f.sim), u_util: num(f.u_util), t_taste: num(f.t_taste),
    s_standing: num(f.s_standing), wwi: num(f.wwi), disc: num(f.disc),
    reasons: f.reasons, avail: f.avail, delta: num(f.delta),
  };
}
type Nb = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; prestige: number | null; sim: number | null;
};

/* ═══════════ inspector nodes ═══════════ */

/** WWI recommendation → WWI breakdown + Cinecodex + availability + 왜. */
function RecInsp({ f }: { f: Rec }) {
  const u = f.v != null && f.r != null ? Math.round(f.v - f.r) : f.ts;
  const chips = reasonChips(f.reasons);
  const av = f.avail;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div>
          <div className="seltitle ser">{f.title}</div>
          <div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""} · 미관람 추천</div>
        </div>
      </div>

      <div className="icard"><h4><i className="ti ti-bolt" /> WWI · 적합도 분해</h4>
        <div className="bigscore" style={{ color: "#86b9ec" }}>{f.wwi ?? "—"}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 6 }}>/ 100 WHY-WATCH</span></div>
        <div className="crow" style={{ marginTop: 8 }}><span className="cl">효용 Utility</span><span className="cbar"><i style={{ width: `${f.u_util ?? 0}%` }} /></span><span className="cvv">{f.u_util ?? "—"}</span></div>
        <div className="crow"><span className="cl">취향 Taste</span><span className="cbar"><i style={{ width: `${f.t_taste ?? 0}%`, background: "#3B5BA5" }} /></span><span className="cvv">{f.t_taste ?? "—"}</span></div>
        <div className="crow"><span className="cl">정전 Standing</span><span className="cbar"><i style={{ width: `${f.s_standing ?? 0}%`, background: "#8a6d3b" }} /></span><span className="cvv">{f.s_standing ?? "—"}</span></div>
        <div className="cc-reasons" style={{ marginTop: 9 }}>{chips.map((c, i) => <span key={i} className={`cc-rsn ${c.cls}`}>{c.label}</span>)}</div>
      </div>

      <div className="icard"><h4><i className="ti ti-coin" /> 자산 지표</h4>
        <div className="kv"><span><span className="gloss" title="정전가 = 이 영화의 객관적 시장가(정전·평단·권위 기반). 내 취향과 무관한 영화 자체의 standing.">정전가</span> (Standing)</span><b>{f.prestige != null ? Math.round(f.prestige) : "—"}</b></div>
        <div className="kv"><span>취향 근접 (sim)</span><b>{f.sim != null ? `${Math.round(f.sim * 100)}%` : "—"}</b></div>
        <div className="kv"><span>Discovery (숨은가치)</span><b>{f.disc != null ? Math.round(f.disc) : "—"}</b></div>
        <div className="kv"><span><span className="gloss" title="Δindex = 이 한 편을 보면 내 NAV가 +N 오른다는 예측 증가분.">Δindex</span> · 이 한 편 보면</span><b style={{ color: "var(--safe)" }}>→ NAV +{f.delta ?? 0}</b></div>
      </div>

      <CinecodexCard d={{ v: f.v, c: null, r: f.r, u, prestige: f.prestige, conf: f.conf, tier: f.tier }} slug={f.slug} />

      <div className="icard"><h4><i className="ti ti-device-tv" /> 지금 볼 수 있나</h4>
        {av && av.state === "on" ? (
          <div className="cc-availrow"><span className="dot on" /><b>{av.provider ?? "가능"}</b><span className="n">지금 볼 수 있음 · KR</span></div>
        ) : (
          <div className="cc-availrow"><span className="dot unk" /><b>미확인</b><span className="n">가용성 정보 없음 ≠ 안 됨</span></div>
        )}
      </div>
    </div>
  );
}

/** Neighbor (별자리 노드 / 미관람 추천) → affinity + V/R. */
function NeighborInsp({ n }: { n: Nb }) {
  const simPct = n.sim != null ? Math.round(n.sim * 100) : null;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={n.poster_path ? { backgroundImage: `url(${IMG}${n.poster_path})` } : {}} />
        <div><div className="seltitle ser">{n.title}</div><div className="selsub">{n.year ?? "?"}{n.director ? ` · ${n.director}` : ""} · 인접 노드</div></div>
      </div>
      <div className="icard"><h4><i className="ti ti-affiliate" /> 취향 근접 · 별자리</h4>
        <div className="bigscore" style={{ color: "var(--reading)" }}>{simPct != null ? simPct : "—"}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 6 }}>/ 100 유사도</span></div>
        <div className="kv" style={{ marginTop: 8 }}><span>V 획득가치</span><b>{n.v != null ? Math.round(n.v) : "—"}</b></div>
        <div className="kv"><span>R 위험 (--risk)</span><b style={{ color: n.r != null && n.r >= 28 ? "var(--risk)" : "var(--ink)" }}>{n.r != null ? Math.round(n.r) : "—"}</b></div>
        <div className="kv"><span>정전가 (시장가)</span><b>{n.prestige != null ? Math.round(n.prestige) : "—"}</b></div>
      </div>
      <div className="icard"><h4><i className="ti ti-info-circle" /> 왜 별자리에 떠올랐나</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          당신의 loved 취향 중심(centroid)과 코사인 유사도 <b style={{ color: "var(--reading)" }}>{n.sim != null ? n.sim.toFixed(3) : "—"}</b> — 가까울수록 별자리 중심에 붙습니다. 실제 친연 지도(가짜 연결 없음).
        </div>
        <div className="actbar" style={{ marginTop: 10 }}><a href={`/room/film/${n.slug}`} className="actbtn pri" style={{ display: "block", textAlign: "center" }}>영화 카드 보기 →</a></div>
      </div>
    </div>
  );
}

/* facet 한국어 라벨 (me_coverage 실 facet) */
const FACET_LABEL: Record<string, string> = {
  canon: "정전", award: "수상", national: "국가", auteur: "감독",
  festival: "영화제", movement: "사조", section: "섹션", style: "스타일",
};
const FACET_GROUP: Record<string, string> = {
  canon: "정전 · 권위 계보 (CANON)", award: "수상 · 시상 (AWARD)",
  national: "국가 · 지역 (NATIONAL)", auteur: "감독 오이브르 (AUTEUR)",
};

type Cov = { label: string; facet: string; seen: number; total: number; pct: number; state: string; aw: number | null };
type Blind = {
  label: string; facet: string; seen: number; total: number;
  ratio: number | null; productivity: number | null; opportunity: number | null; gap_reason: string; aw: number | null;
};

/** Lineage coverage row → 도장깨기 상세 (엔진⑦ 실측). */
function LineageInsp({ c }: { c: Cov }) {
  const pct = c.pct;
  const st = covState(pct);
  const remain = Math.max(0, Math.ceil(c.total * 0.5) - c.seen);
  const isBlind = pct === 0 || c.seen / Math.max(1, c.total) < 0.03;
  return (
    <div>
      <div className="icard"><h4><i className="ti ti-layout-grid" /> 계보 상세 · 커버리지</h4>
        <div className="seltitle ser" style={{ fontSize: 16 }}>{c.label}</div>
        <div className="selsub">{FACET_LABEL[c.facet] ?? c.facet} 계보 {isBlind ? "· 블라인드" : ""}</div>
        <div className="bigscore" style={{ marginTop: 10, color: st.col }}>{pct}%<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>{c.seen} / {c.total} 관람 · {st.label}</span></div>
        <div className="crow" style={{ marginTop: 8 }}><span className="cl"><span className="gloss" title="커버리지 = 이 계보 목록 중 내가 본 비율(%).">커버리지</span></span><span className="cbar"><i style={{ width: `${Math.max(pct, pct > 0 ? 3 : 1)}%`, background: st.col }} /></span><span className="cvv">{pct}</span></div>
        <div className="cc-ms">
          {[50, 75, 100].map((m) => {
            const on = pct >= m;
            const cls = on ? (m === 100 ? "conquer" : "canon") : "";
            return <span key={m} className={`cc-rsn ${cls}`} style={on ? {} : { opacity: 0.4 }}>{m}%</span>;
          })}
        </div>
        <div style={{ fontSize: 11, color: "var(--canon)", marginTop: 9 }}><i className="ti ti-flag" /> {pct >= 100 ? "완파 완료" : `50% 완파까지 ${remain}편`}</div>
      </div>
      <div className="icard"><h4><i className="ti ti-target" /> 왜 이 계보인가</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          {isBlind
            ? <>아직 거의 밟지 않은 <b style={{ color: "var(--blind)" }}>블라인드</b> 권위 계보 — 첫 진입이 커버리지·다양성을 가장 크게 끌어올립니다.</>
            : <>권위 있는 정전 목록. 남은 편수를 채울수록 breadth(계보 폭)와 depth(깊이)가 함께 오릅니다.</>}
        </div>
      </div>
    </div>
  );
}

/** Blind spot → 왜 이 공백인가 (엔진④ opportunity 분해 — 설명가능 인스펙터). */
function BlindInsp({ b }: { b: Blind }) {
  const covPct = b.total ? Math.round((b.seen / b.total) * 100) : 0;
  return (
    <div>
      <div className="icard"><h4><i className="ti ti-eye-off" style={{ color: "var(--blind)" }} /> 블라인드 상세</h4>
        <div className="seltitle ser" style={{ fontSize: 16 }}>{b.label}</div>
        <div className="selsub">{FACET_LABEL[b.facet] ?? b.facet} 계보 · {b.gap_reason === "untouched" ? "미답 (0편)" : "얕음 (<3%)"}</div>
        <div className="bigscore" style={{ marginTop: 10, color: "var(--blind)" }}>{b.seen}/{b.total}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>관람 · {covPct}%</span></div>
      </div>
      <div className="icard"><h4><i className="ti ti-scale" /> 기회값 분해 · 왜 이 공백인가</h4>
        <div className="kv"><span>권위 (authority)</span><b>{b.aw != null ? b.aw.toFixed(2) : "—"}</b></div>
        <div className="kv"><span>미답률 (1 − coverage)</span><b>{b.ratio != null ? (1 - b.ratio).toFixed(2) : "—"}</b></div>
        <div className="kv"><span><span className="gloss" title="생산성 = 내 취향 벡터와 이 계보 앵커의 코사인 근접(0.35–1 클립). 취향에 인접한 '안전한 모험'만 권유하는 엔진④ 게이트.">생산성 게이트</span></span><b style={{ color: "var(--safe)" }}>{b.productivity != null ? b.productivity.toFixed(2) : "—"}</b></div>
        <div className="kv"><span>기회값 (opportunity)</span><b style={{ color: "var(--blind)" }}>{b.opportunity != null ? b.opportunity.toFixed(2) : "—"}</b></div>
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 8, lineHeight: 1.55 }}>
          기회값 = 권위 × 미답률 × <b style={{ color: "var(--ink)" }}>생산성</b> — 단순 결핍을 다 들이밀지 않고, 내 취향에 인접해 <b>실제로 밟을 만한</b> 공백만 순위에 올립니다. 게이지는 고발이 아니라 권유입니다.
        </div>
      </div>
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function CommandCenterWorkspace({ data }: { data: CommandData }) {
  const insp = useInspector();
  const { setDefault } = insp;

  /* ── NAV + components ── */
  const nav = num(data.nav?.nav);
  const nWatched = num(data.nav?.n_watched) ?? 0;
  const nScored = num(data.nav?.n_scored) ?? 0;
  const essentials = num(data.nav?.essentials) ?? 0;
  const avgStanding = num(data.nav?.avg_standing);
  const lines = num(data.nav?.lines) ?? 0;
  const forming = nav == null; // <8 watched → NAV null → 형성 중

  /* 4 honest components (0..1), each LABELLED. Derived, never invented. */
  const breadth = clamp01(lines / 60);                 // 계보 폭 — # lineages touched (~60 = broad)
  const prestige = avgStanding != null ? clamp01(avgStanding / 100) : 0; // 평균 정전
  const depth = clamp01(essentials / 20);              // 필수작 깊이 (essentials='필수작')
  const discovery = data.avgDiscovery != null ? clamp01(data.avgDiscovery / 60) : 0; // 발굴 avg

  const components = [
    { key: "breadth", label: "breadth 폭", v: breadth, color: "var(--frontier)" },
    { key: "prestige", label: "prestige 권위", v: prestige, color: "var(--canon)" },
    { key: "depth", label: "depth 깊이", v: depth, color: "var(--safe)" },
    { key: "disc", label: "disc 발굴", v: discovery, color: "var(--reading)" },
  ];

  const tierLabel = nav == null ? "형성 중"
    : nav >= 90 ? "APEX" : nav >= 70 ? "ESTABLISHED" : nav >= 45 ? "BUILDING" : "FORMING";

  /* NAV ring geometry (inline SVG like EvalCard donut) */
  const RING_C = 2 * Math.PI * 38;
  const ringFrac = nav != null ? clamp01(nav / 100) : 0;

  /* ── 엔진⑦ me_coverage: 전 facet 실측 rows (portfolio_breakdown.canon 파생 제거) ── */
  const covAll = useMemo<Cov[]>(() => data.coverage.map((c) => ({
    label: c.label, facet: c.facet, seen: c.seen, total: c.total, pct: c.pct, state: c.state, aw: num(c.aw),
  })), [data.coverage]);

  /* facet별 그룹 (RPC가 pct desc 정렬 — 그룹 안 순서 유지, 그룹당 상위 6) */
  const covByFacet = useMemo(() => (["canon", "award", "national", "auteur"] as const)
    .map((f) => ({ facet: f as string, rows: covAll.filter((c) => c.facet === f).slice(0, 6) }))
    .filter((g) => g.rows.length), [covAll]);

  /* 전체 커버리지 % = Σseen/Σtotal (전 facet, 실측 분모) */
  const overall = useMemo(() => {
    const tot = covAll.reduce((a, c) => a + c.total, 0);
    const seen = covAll.reduce((a, c) => a + c.seen, 0);
    return tot ? (seen / tot) * 100 : null;
  }, [covAll]);

  /* ── 엔진④ me_blindspots: 생산성 게이트 통과한 블라인드 (기회값 순) ── */
  const blind = useMemo<Blind[]>(() => data.blinds.map((b) => ({
    label: b.label, facet: b.facet, seen: b.seen, total: b.total,
    ratio: num(b.ratio), productivity: num(b.productivity), opportunity: num(b.opportunity),
    gap_reason: b.gap_reason, aw: num(b.aw),
  })), [data.blinds]);

  /* ── recommendations ── */
  const recs = useMemo(() => data.recs.map(normRec), [data.recs]);
  /* 오늘의 한 편 = 최대 delta (tie → 최대 wwi) */
  const today = useMemo(() => {
    if (!recs.length) return null;
    return [...recs].sort((a, b) => (b.delta ?? -1) - (a.delta ?? -1) || (b.wwi ?? -1) - (a.wwi ?? -1))[0];
  }, [recs]);
  /* ranked list by wwi desc */
  const ranked = useMemo(() => [...recs].sort((a, b) => (b.wwi ?? -1) - (a.wwi ?? -1)), [recs]);

  /* ── neighbors (별자리) ── */
  const neighbors = useMemo(() => data.neighbors.map((n) => ({
    slug: n.slug, title: n.title, year: n.year, poster_path: n.poster_path, director: n.director,
    v: num(n.v), r: num(n.r), prestige: num(n.prestige), sim: num(n.sim),
  })), [data.neighbors]);

  /* constellation geometry: central "나(취향)" node, neighbors placed radially.
     Higher sim → closer (smaller radius) & bigger node. Real affinity map, no fake links. */
  const CON_W = 700, CON_H = 300, CX = 350, CY = 150;
  const conNodes = useMemo(() => {
    const withSim = neighbors.filter((n) => n.sim != null) as (Nb & { sim: number })[];
    const top = withSim.slice(0, 12);
    if (!top.length) return [];
    const sims = top.map((n) => n.sim);
    const sMin = Math.min(...sims), sMax = Math.max(...sims);
    const span = sMax - sMin || 1;
    const n = top.length;
    return top.map((nb, i) => {
      const t = (nb.sim - sMin) / span;          // 0 (farthest) .. 1 (closest)
      const radius = 128 - t * 66;                // closer sim → smaller radius (62..128)
      const size = 4 + t * 6;                     // bigger for higher sim
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        ...nb,
        x: CX + Math.cos(ang) * radius * 1.9,     // wider horizontally (ellipse)
        y: CY + Math.sin(ang) * radius,
        r: size,
      };
    });
  }, [neighbors]);

  const openRec = (f: Rec) => insp.select(<RecInsp f={f} />, `${f.title} · 추천`);
  const openNeighbor = (n: Nb) => insp.select(<NeighborInsp n={n} />, `${n.title} · 별자리`);
  const openLineage = (c: Cov) => insp.select(<LineageInsp c={c} />, `${c.label} · 계보`);
  const openBlind = (b: Blind) => insp.select(<BlindInsp b={b} />, `${b.label} · 블라인드`);

  /* ── default inspector = 커맨드센터 요약 (mirrors AnalysisWorkspace setDefault) ── */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-dashboard" /> 커맨드센터 요약</h4>
          <div className="kv"><span><span className="gloss" title="NAV (Net Asset Value) = 내 영화 자산의 총량. 폭·권위·깊이·발굴을 합산한 단일 점수.">NAV</span> · 자산 총량</span><b>{nav ?? "형성 중"}</b></div>
          <div className="kv"><span>레벨</span><b>{tierLabel}</b></div>
          <div className="kv"><span>보유 (관람)</span><b>{nWatched}</b></div>
          <div className="kv"><span>계보 라인</span><b>{lines}</b></div>
          <div className="kv"><span>평균 정전가</span><b>{avgStanding != null ? Math.round(avgStanding) : "—"}</b></div>
          <div className="kv"><span>필수작 (깊이)</span><b>{essentials}</b></div>
        </div>
        <div className="icard"><h4><i className="ti ti-eye-off" /> 블라인드 · 커버리지</h4>
          <div className="kv"><span>전체 커버리지</span><b>{overall != null ? `${overall.toFixed(1)}%` : "—"}</b></div>
          <div className="kv"><span><span className="gloss" title="블라인드 = 아직 0~소수만 본 권위 있는 계보. 정복하지 못한 영역.">블라인드</span> 계보</span><b style={{ color: "var(--blind)" }}>{blind.length}</b></div>
          <div className="kv"><span>추천 대기</span><b>{recs.length}</b></div>
          <div className="kv"><span>별자리 노드</span><b>{conNodes.length}</b></div>
        </div>
        <div className="emptyins">추천 · 계보 · 별자리 노드를 클릭하면 여기에 상세 · 왜가 열립니다.</div>
      </div>
    );
  }, [data, nav, tierLabel, nWatched, lines, avgStanding, essentials, overall, blind.length, recs.length, conNodes.length, setDefault]);

  return (
    <div className="mainpad">
      <h1 className="secttl">현황 · 커맨드센터</h1>
      <p className="secsub">
        내 영화적 자산의 하루를 여는 대시보드 — <span className="gloss" title="NAV (Net Asset Value) = 내 영화 자산의 총량. 폭·권위·깊이·발굴을 합산한 단일 점수.">자산 총량(NAV)</span> · 오늘 볼 한 편 · 무엇을 하면 되나. 모든 숫자는 실측이며, 부족한 곳은 정직하게 <b style={{ fontStyle: "normal", color: "var(--forming)" }}>형성 중</b>으로 둡니다.
      </p>

      {/* ═══ HERO · NAV + components ═══ */}
      <div className="cc-hero">
        {forming ? (
          <div className="cc-navbig">
            <div className="cc-forming">
              <i className="ti ti-seedling" />
              <div>
                <div className="eb">영화적 자산 · <span className="gloss" title="NAV (Net Asset Value) = 내 영화 자산의 총량.">Net Asset Value</span></div>
                <div className="cc-lvl forming">● 형성 중</div>
                <div className="cc-pctl">{nWatched}편 — 8편부터 NAV·레벨 산출 (NaN 0건)</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="cc-navbig">
            <div className="cc-ring">
              <svg width="92" height="92" viewBox="0 0 92 92">
                <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
                <circle cx="46" cy="46" r="38" fill="none" stroke="var(--red)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={RING_C.toFixed(1)} strokeDashoffset={(RING_C * (1 - ringFrac)).toFixed(1)} transform="rotate(-90 46 46)" />
                <text x="46" y="44" textAnchor="middle" fontSize="19" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{nav}</text>
                <text x="46" y="58" textAnchor="middle" fontSize="8.5" fill="#6C6960" letterSpacing="1.5">NAV</text>
              </svg>
            </div>
            <div className="cc-navmeta">
              <div className="eb">영화적 자산 · <span className="gloss" title="NAV (Net Asset Value) = 내 영화 자산의 총량. 폭·권위·깊이·발굴을 합산한 단일 점수.">Net Asset Value</span></div>
              <div className="cc-lvl">● LV. {tierLabel}</div>
              <div className="cc-pctl">보유 <b>{nWatched}</b> · 평가 <b>{nScored}</b> · <span className="gloss" title="정전가 = 영화가 나와 무관하게 받은 인정 = 객관 시장가.">평균 정전가</span> <b>{avgStanding != null ? Math.round(avgStanding) : "—"}</b></div>
            </div>
          </div>
        )}
        <div className="cc-components">
          {components.map((c) => (
            <div className="cc-comp" key={c.key}>
              <span className="cl">{c.label}</span>
              <div className="ct"><i style={{ width: forming ? "0%" : `${Math.round(c.v * 100)}%`, background: c.color }} /></div>
              <span className="cv">{forming ? "—" : c.v.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="cc-explain"><i className="ti ti-info-circle" /> NAV = 폭(breadth)·권위(prestige)·깊이(depth)·발굴(disc)의 합성 — <b>관람은 절대 NAV를 깎지 않는다</b>(저평점은 P&amp;L regret에만). 4 성분은 각각 계보 라인 · 평균 정전가 · 필수작 · 평균 Discovery에서 정직하게 유도.</div>
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div className="cc-kpis">
        <div className="cc-kpi"><div className="eb">보유 영화</div><div className="v">{nWatched}</div><div className="d flat">관람 자산</div></div>
        <div className="cc-kpi"><div className="eb">계보 라인</div><div className="v">{lines}</div><div className="d flat">정전·수상·국가</div></div>
        <div className="cc-kpi"><div className="eb"><span className="gloss" title="커버리지 = 권위 계보 목록 중 내가 본 비율(%).">커버리지</span></div><div className="v">{overall != null ? overall.toFixed(1) : "—"}<small>%</small></div><div className="d flat">정전 우주 대비</div></div>
        <div className="cc-kpi"><div className="eb">Discovery</div><div className="v">{data.avgDiscovery != null ? Math.round(data.avgDiscovery) : "—"}</div><div className="d dn">{data.avgDiscovery != null && data.avgDiscovery < 20 ? "정전 추종형" : "발굴 지수"}</div></div>
        <div className="cc-kpi"><div className="eb"><span className="gloss" title="블라인드 = 아직 0~소수만 본 권위 있는 계보. 정복하지 못한 영역.">블라인드</span> 계보</div><div className="v">{blind.length}</div><div className="d blind">아직 안 간 땅</div></div>
      </div>

      {/* ═══ 오늘의 한 편 (최대 Δ) ═══ */}
      {today ? (
        <div className="cc-today" onClick={() => openRec(today)}>
          <div className="cc-tlead">
            <span className="cc-tnum">#1</span>
            <div className="cc-tbody">
              <div className="cc-tk"><i className="ti ti-bolt" style={{ fontSize: 10 }} /> 오늘의 한 편 · 최대 Δ · → NAV +{today.delta ?? 0}</div>
              <div className="cc-tt">{today.title} <small>{today.year ?? ""}{today.director ? ` · ${today.director}` : ""}</small></div>
              <div className="cc-ts">
                <span className="gloss" title="WWI = 이 영화가 나에게 맞는 정도(0–100). 취향·계보·공백을 합산한 Why-Watch Index.">WWI</span> {today.wwi ?? "—"} · <span className="gloss" title="Δindex = 이 한 편을 보면 내 NAV가 +N 오른다는 예측 증가분.">Δindex</span> <b>+{today.delta ?? 0}</b>
                {today.avail && today.avail.state === "on" ? <> — 지금 {today.avail.provider ?? ""}에서 볼 수 있음</> : <> — 가용성 미확인</>}
              </div>
            </div>
          </div>
          <div className="cc-tact">
            <span className="cc-tbtn pri"><i className="ti ti-arrow-down" /> 추천 자세히</span>
          </div>
        </div>
      ) : null}

      {/* ═══ WWI 추천 데스크 (⑤ S1) ═══ */}
      <div className="cc-mod">
        <div className="cc-modh"><h3><i className="ti ti-bolt" /> WHY-WATCH 추천 데스크 · 다음 한 편의 알파 <span className="ix">⑤</span></h3>
          <span className="meta">미관람 · WWI 순 · 행 클릭=분석</span></div>
        <div className="cc-modbody">
          {ranked.length ? ranked.map((f, i) => {
            const chips = reasonChips(f.reasons);
            const rc = riskDotCls(f.r);
            const on = f.avail && f.avail.state === "on";
            return (
              <div key={f.slug} className="cc-rrow" onClick={() => openRec(f)}>
                <div className="cc-rk">{i + 1}</div>
                <div>
                  <div className="cc-rt">{f.title} <small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
                  <div className="cc-rsub">
                    <span className={`cc-avdot ${on ? "on" : "unk"}`} title={on ? `지금 볼 수 있음 · ${f.avail?.provider ?? ""}` : "가용성 미확인"} />
                    {on ? `${f.avail?.provider ?? "가능"}` : "미확인"}
                    {f.r != null ? <span className={`cc-rdot ${rc}`} title={`Cinecodex 위험 R ${Math.round(f.r)} (--risk · 완파 red 아님)`}>R {Math.round(f.r)}</span> : null}
                  </div>
                  <div className="cc-reasons">{chips.map((c, j) => <span key={j} className={`cc-rsn ${c.cls}`}>{c.label}</span>)}</div>
                </div>
                <div className="cc-wwi"><div className="pv" style={{ color: "#86b9ec" }}>{f.wwi ?? "—"}</div><div className="pl">WWI</div></div>
                <div className="cc-dlt">+{f.delta ?? 0}<small>→ NAV</small></div>
                <div className="cc-wwi"><div className="pv" style={{ color: "var(--reading)", fontSize: 16 }}>{f.sim != null ? Math.round(f.sim * 100) : "—"}</div><div className="pl">SIM</div></div>
              </div>
            );
          }) : <div className="emptyins">아직 추천을 낼 만큼 취향 벡터가 형성되지 않았습니다. 영화를 더 평가하면 다음 한 편 후보가 채워집니다.</div>}
        </div>
      </div>

      {/* ═══ 커버리지 매트릭스 (⑦ S4) ═══ */}
      <div className="cc-mod">
        <div className="cc-modh"><h3><i className="ti ti-layout-grid" /> 계보 <span className="gloss" title="커버리지 = 계보 목록 중 내가 본 비율(%). 전 facet(정전·수상·국가·감독) 실측 분모.">커버리지</span> 매트릭스 <span className="ix">⑦</span></h3>
          <span className="meta">전 facet 실측 (me_coverage) · 잠금&lt;50 진행50–74 근접75–99 완파100</span></div>
        <div className="cc-modbody">
          {covByFacet.length ? (
            <>
              {covByFacet.map((g) => (
                <div key={g.facet}>
                  <div className="cc-grp"><span>{FACET_GROUP[g.facet] ?? g.facet}</span><span>관람 · %</span></div>
                  {g.rows.map((c) => {
                    const st = covState(c.pct);
                    return (
                      <div key={`${g.facet}-${c.label}`} className={`cc-lrow ${st.cls}`} onClick={() => openLineage(c)} title={`${c.label} — ${c.seen}/${c.total}`}>
                        <div className="cc-lname">{c.label}</div>
                        <div className="cc-barwrap"><div className="cc-track"><i style={{ width: `${Math.max(c.pct, c.pct > 0 ? 3 : 1)}%` }} /></div><span className="cc-pct">{c.pct}%</span></div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <span className="cc-frac">{c.seen}/{c.total}</span>
                          <span className="cc-statetag">{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9, fontStyle: "italic" }}>
                분모는 계보별 실제 등재 편수(실측)입니다 — 대형 목록의 낮은 %는 정직한 상태. facet별 상위 6개 표시, 전체 커버리지 KPI는 전 계보 합산.
              </div>
            </>
          ) : <div className="emptyins">계보 커버리지 데이터가 아직 없습니다. 관람 표본이 계보에 매칭되면 커버리지 바가 나타납니다.</div>}
        </div>
      </div>

      {/* ═══ 블라인드 (④ S2 amber) ═══ */}
      <div className="cc-mod">
        <div className="cc-modh"><h3><i className="ti ti-eye-off" style={{ color: "var(--blind)" }} /> <span className="gloss" title="블라인드 = 아직 0~소수만 본 권위 있는 계보. 정복하지 못한 영역.">블라인드</span> · 아직 안 간 권위 계보 <span className="ix">④</span></h3>
          <span className="meta">미답·얕음(&lt;3%) · 생산성 게이트 통과 · 기회값 순</span></div>
        <div className="cc-modbody">
          {blind.length ? (
            <div className="cc-blindwrap">
              {blind.map((b) => (
                <div key={`${b.facet}-${b.label}`} className="cc-blindchip" onClick={() => openBlind(b)} title={`${b.label} — ${b.seen}/${b.total} · 기회값 ${b.opportunity != null ? b.opportunity.toFixed(2) : "—"}`}>
                  <i className="ti ti-eye-off" />
                  <span>{b.label}</span>
                  <b>{b.seen}/{b.total}</b>
                  <small>{FACET_LABEL[b.facet] ?? b.facet}</small>
                </div>
              ))}
            </div>
          ) : <div className="emptyins">블라인드 계보가 없습니다 — 취향 인접한 권위 계보에 모두 진입했습니다.</div>}
        </div>
      </div>

      {/* ═══ 별자리 (⑥) ═══ */}
      <div className="cc-mod">
        <div className="cc-modh"><h3><i className="ti ti-affiliate" /> 별자리 · 취향 인접 <span className="ix">⑥</span></h3>
          <span className="meta">me_taste_neighbors · sim = 코사인 유사도</span></div>
        <div className="cc-modbody">
          {conNodes.length ? (
            <>
              <svg className="cc-consvg" viewBox={`0 0 ${CON_W} ${CON_H}`} width="100%" role="img" aria-label="취향 별자리 — 나(중심)와 인접 미관람작">
                {/* connecting lines (real affinity, thin; brighter for higher sim) */}
                <g>
                  {conNodes.map((n) => (
                    <line key={`l${n.slug}`} x1={CX} y1={CY} x2={n.x} y2={n.y}
                      stroke="var(--blind)" strokeOpacity={0.15 + (n.sim ?? 0) * 0.5} strokeWidth="1" strokeDasharray="3 3" />
                  ))}
                </g>
                {/* neighbor nodes */}
                {conNodes.map((n) => {
                  const nearRight = n.x > CX;
                  return (
                    <g key={n.slug} className="cc-node" onClick={() => openNeighbor(n)}>
                      <title>{n.title} · sim {n.sim != null ? n.sim.toFixed(3) : "—"}</title>
                      <circle cx={n.x} cy={n.y} r={14} fill="transparent" />
                      <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="var(--blind)" strokeWidth="1.5" />
                      <text x={nearRight ? n.x + n.r + 5 : n.x - n.r - 5} y={n.y + 3}
                        textAnchor={nearRight ? "start" : "end"} fontSize="9.5" fontFamily="PT Serif,serif" fill="#edc873">{n.title}</text>
                    </g>
                  );
                })}
                {/* central node = 나(취향) */}
                <circle cx={CX} cy={CY} r={10} fill="var(--red)" />
                <text x={CX} y={CY - 15} textAnchor="middle" fontSize="11" fontFamily="PT Serif,serif" fill="#ECEAE5">나 (취향)</text>
              </svg>
              <div className="cc-legend">
                <span><i style={{ background: "var(--red)" }} />나 (취향 중심)</span>
                <span><i style={{ background: "transparent", border: "1.5px solid var(--blind)" }} />인접 미관람작 (가까울수록 sim↑)</span>
                <span style={{ color: "var(--sub)" }}>노드 크기·거리 = 코사인 유사도 (실제 친연, 가짜 연결 없음)</span>
              </div>
            </>
          ) : <div className="emptyins">아직 별자리를 그릴 만큼 취향 벡터가 형성되지 않았습니다. 영화를 더 평가하면 가장 가까운 미관람작이 별자리로 떠오릅니다.</div>}
        </div>
      </div>
    </div>
  );
}
