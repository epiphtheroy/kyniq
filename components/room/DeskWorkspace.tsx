"use client";
/** 운용 데스크 (Asset Desk) — ported from mockup-me-asset-desk.html (DESIGN SOURCE OF TRUTH).
 *  REAL data via Supabase RPCs (all auth.uid()-scoped):
 *   - me_recommend_wwi(1.0, 48) → 5-전략 보드 (safe/frontier/conquer/gap/canon) bucketed by reasons[]
 *     + S1 「오늘의 한 편」 = 최대 Δ. λ 다이얼 recomputes U=V−λ·R & re-sorts; S(샤프) sort toggle.
 *   - me_watched_scored()   → P&L 적중률(★3.5+) · regret(★≤2.0 = 회수 실패) · 평균 별점 · 관람 수
 *   - me_takescore_summary() → avg_v/avg_r/best/riskiest (자산 요약)
 *   - me_nav_history()       → 자산곡선 (nav_snapshots 실측 + 오늘 라이브 NAV — 합성 없음, 단조 어서션)
 *  담기/봤어요 = me_set_watchlist/me_mark_seen 실 mutation (auth.uid 스코프, 낙관적 UI + 토스트).
 *  Inspector-swap mirrors WatchlistWorkspace/CommandCenterWorkspace (setDefault in useEffect deps
 *  [data,setDefault]; insp.select on click; reuse CinecodexCard for films). PostgREST numerics arrive
 *  as strings → coerced with num() before any .toFixed()/+. */
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

/* ── typed RPC shapes (numerics may arrive as strings from PostgREST) ── */
export type Avail = { state: string; provider?: string } | null;
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; ts: number | string | null;
  prestige: number | string | null; conf: number | string | null; tier: string | null;
  sim: number | string | null; u_util: number | string | null; t_taste: number | string | null;
  s_standing: number | string | null; wwi: number | string | null; disc: number | string | null;
  reasons: string[] | null; avail: Avail; delta: number | string | null; in_watchlist?: boolean | null;
};

export type WatchedRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null; v: number | string | null; c: number | string | null; r: number | string | null;
};

export type TakeSummary = {
  n_watched?: number | string | null; n_scored?: number | string | null; median_ts?: number | string | null;
  avg_v?: number | string | null; avg_r?: number | string | null; value_gap?: number | string | null;
  best?: { slug: string; title: string; ts?: number | string | null } | null;
  riskiest?: { slug: string; title: string; r?: number | string | null } | null;
} | null;

/* me_nav_history — 과거 스냅샷 + 오늘 라이브 NAV (실측만, 합성 없음) */
export type NavPoint = { day: string; nav: number | string | null; n_watched: number | string | null };

export type DeskData = {
  recs: WwiRow[];
  watched: WatchedRow[];
  summary: TakeSummary;
  navHistory: NavPoint[];
};

const IMG = "https://image.tmdb.org/t/p/w92";
const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

/* ── normalized rec (all numerics coerced once) ── */
type Rec = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; ts: number | null; prestige: number | null; conf: number | null;
  tier: string | null; sim: number | null; u_util: number | null; t_taste: number | null;
  s_standing: number | null; wwi: number | null; disc: number | null;
  reasons: string[]; avail: Avail; delta: number | null;
};
function normRec(f: WwiRow): Rec {
  return {
    slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, director: f.director,
    v: num(f.v), r: num(f.r), ts: num(f.ts), prestige: num(f.prestige), conf: num(f.conf),
    tier: f.tier, sim: num(f.sim), u_util: num(f.u_util), t_taste: num(f.t_taste),
    s_standing: num(f.s_standing), wwi: num(f.wwi), disc: num(f.disc),
    reasons: f.reasons ?? [], avail: f.avail, delta: num(f.delta),
  };
}
type Watched = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; v: number | null; c: number | null; r: number | null;
};
function normWatched(w: WatchedRow): Watched {
  return {
    slug: w.slug, title: w.title, year: w.year, poster_path: w.poster_path, director: w.director,
    rating: num(w.rating), v: num(w.v), c: num(w.c), r: num(w.r),
  };
}

/* ── engine ⑨ risk-adjusted primitives (client-side, λ-aware) ── */
const utilityU = (r: Rec, lam: number): number | null =>
  r.v != null && r.r != null ? Math.round(r.v - lam * r.r) : r.ts;                 // U = V − λ·R
const sharpeS = (r: Rec): number | null =>
  r.v != null ? (r.v - 50) / Math.max(r.r ?? 1, 1) : null;                          // S = (V−50)/max(R,1)

/* ── 5 전략 정본 (MASTER-INDEX §4) ── each bucketed by the reason codes a candidate carries ── */
type Strat = { key: string; code: string; name: string; sub: string; color: string; empty: string };
const STRATS: Strat[] = [
  { key: "safe", code: "safe", name: "안전자산", color: "var(--safe)",
    sub: "취향 벡터와 가장 가까운 of-course 우량주 — 하방 거의 없음.",
    empty: "안전자산 후보가 아직 없습니다 — 취향에 가장 가까운 저위험 우량주가 채워지면 표시됩니다." },
  { key: "frontier", code: "frontier", name: "안전한 모험", color: "var(--frontier)",
    sub: "미답 사조이되 신뢰하는 감독·정전 닻이 하방을 받친 다리.",
    empty: "안전한 모험 후보가 아직 없습니다." },
  { key: "conquer", code: "conquer", name: "도장깨기", color: "var(--conquer)",
    sub: "계보·감독 라인 완파를 한 편으로 진척 — 마일스톤 직격.",
    empty: "형성 중 · 완파(coverage) 엔진이 아직 이 후보를 붙이지 않았습니다 — conquer 이유는 계보 완파 진척 엔진이 붙습니다." },
  { key: "gap", code: "gap", name: "공백 충족", color: "var(--gap)",
    sub: "0% 대륙·연대 블라인드를 처음 여는 한 편 — 폭 증분 최대.",
    empty: "형성 중 · 블라인드 공백 매핑이 아직 이 후보를 gap으로 태깅하지 않았습니다." },
  { key: "canon", code: "canon", name: "정전 위상", color: "var(--canon)",
    sub: "권위·정전 위상이 높은 미관람 — prestige 증분과 안전망을 동시에.",
    empty: "정전 위상 후보가 아직 없습니다." },
];

const REASON_MAP: Record<string, { cls: string; label: string }> = {
  safe: { cls: "safe", label: "안전자산" },
  reading: { cls: "reading", label: "취향 적중" },
  canon: { cls: "canon", label: "정전 위상" },
  gap: { cls: "gap", label: "공백 충족" },
  frontier: { cls: "frontier", label: "안전한 모험" },
  conquer: { cls: "conquer", label: "도장깨기" },
};
function reasonChips(codes: string[]): { cls: string; label: string }[] {
  return (codes.length ? codes : ["frontier"]).slice(0, 3).map((c) => REASON_MAP[c] ?? { cls: "frontier", label: c });
}
const wwiColor = (w: number | null) => (w == null ? "var(--ink)" : w >= 62 ? "#e0bb6e" : w >= 58 ? "#86b9ec" : "#ECEAE5");
const riskBadgeCls = (r: number | null) => (r != null && r >= 29 ? " hi" : "");

/* ═══════════ inspector nodes ═══════════ */

/** WWI recommendation → WWI 분해 + Cinecodex + 자산 지표 + 가용. Mirrors WatchlistWorkspace.Insp. */
function RecInsp({ f, lam, onKeep, onSeen }: {
  f: Rec; lam: number;
  onKeep?: (f: Rec) => void; onSeen?: (f: Rec) => void;
}) {
  const u = utilityU(f, lam);
  const s = sharpeS(f);
  const chips = reasonChips(f.reasons);
  const on = f.avail?.state === "on";
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
        <div className="bigscore" style={{ color: "#86b9ec", fontSize: 30 }}>{f.wwi ?? "—"}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 6 }}>/ 100 WHY-WATCH</span></div>
        <div className="crow" style={{ marginTop: 8 }}><span className="cl">효용 Utility</span><span className="cbar"><i style={{ width: `${f.u_util ?? 0}%` }} /></span><span className="cvv">{f.u_util ?? "—"}</span></div>
        <div className="crow"><span className="cl">취향 Taste</span><span className="cbar"><i style={{ width: `${f.t_taste ?? 0}%`, background: "#3B5BA5" }} /></span><span className="cvv">{f.t_taste ?? "—"}</span></div>
        <div className="crow"><span className="cl">정전 Standing</span><span className="cbar"><i style={{ width: `${f.s_standing ?? 0}%`, background: "#8a6d3b" }} /></span><span className="cvv">{f.s_standing ?? "—"}</span></div>
        <div className="dk-inspreason">{chips.map((c, i) => <span key={i} className={`dk-rsn ${c.cls}`}>{c.label}</span>)}</div>
      </div>

      <div className="icard"><h4><i className="ti ti-coin" /> 자산 지표 · Δindex → NAV</h4>
        <div className="kv"><span><span className="gloss" title="정전가 = 이 영화의 객관적 시장가(정전·평단·권위 기반). 내 취향과 무관한 영화 자체의 standing.">정전가</span> (Standing)</span><b>{f.prestige != null ? Math.round(f.prestige) : "—"}</b></div>
        <div className="kv"><span>Discovery (숨은가치)</span><b>{f.disc != null ? Math.round(f.disc) : "—"}</b></div>
        <div className="kv"><span>순가치 U <span style={{ color: "var(--sub)" }}>(λ{lam})</span></span><b>{u ?? "—"}</b></div>
        <div className="kv"><span>샤프 S · 위험조정</span><b>{s != null ? s.toFixed(2) : "—"}</b></div>
        <div className="kv"><span><span className="gloss" title="Δindex = 이 한 편을 보면 내 NAV가 +N 오른다는 예측 증가분.">Δindex</span> · 이 한 편 보면</span><b style={{ color: "var(--safe)" }}>→ NAV +{f.delta ?? 0}</b></div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 7 }}><i className="ti ti-shield-check" style={{ color: "var(--safe)" }} /> 매수해도 NAV는 오르기만 한다 — 저평점이 나와도 regret(P&amp;L)일 뿐 NAV drawdown 아님.</div>
      </div>

      <CinecodexCard d={{ v: f.v, c: null, r: f.r, u, prestige: f.prestige, discovery: f.disc, conf: f.conf, tier: f.tier }} slug={f.slug} />

      <div className="icard"><h4><i className="ti ti-device-tv" /> 지금 볼 수 있나 · 가용</h4>
        {on ? (
          <div className="dk-availrow"><span className="dot" style={{ background: "var(--avail)" }} /><b style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{f.avail?.provider ?? "가능"}</b><span style={{ color: "var(--sub)", fontSize: 10.5 }}>지금 볼 수 있음 · KR</span></div>
        ) : (
          <div className="dk-availrow"><span className="dot" style={{ background: "var(--sub)" }} /><b style={{ fontFamily: "var(--mono)", fontSize: 11 }}>미확인</b><span style={{ color: "var(--sub)", fontSize: 10.5 }}>가용성 정보 없음 ≠ 안 됨</span></div>
        )}
      </div>

      <div className="actbar">
        <span className="actbtn pri" onClick={() => onKeep?.(f)}>+ 볼 영화에 담기</span>
        <span className="actbtn" onClick={() => onSeen?.(f)}>봤어요</span>
      </div>
    </div>
  );
}

/** Regret (관람 후 저평점 = 회수 실패) → P&L regret 상세. NAV 불변 강조. */
function RegretInsp({ w }: { w: Watched }) {
  const s = w.v != null ? (w.v - 50) / Math.max(w.r ?? 1, 1) : null;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={w.poster_path ? { backgroundImage: `url(${IMG}${w.poster_path})` } : {}} />
        <div>
          <div className="seltitle ser">{w.title}</div>
          <div className="selsub">{w.year ?? "?"}{w.director ? ` · ${w.director}` : ""} · 관람 · ★{w.rating != null ? w.rating.toFixed(1) : "—"}</div>
        </div>
      </div>
      <div className="icard cc-card"><h4><i className="ti ti-mood-sad" /> P&amp;L REGRET · 회수 실패</h4>
        <div className="bigscore" style={{ color: "#f2a39f", fontSize: 30 }}>★{w.rating != null ? w.rating.toFixed(1) : "—"}</div>
        <div style={{ fontSize: 11, color: "#5fd0b2", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-shield-check" /> NAV 불변 — 자산 평가절하 없음
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-info-circle" /> regret ≠ NAV drawdown</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          관람 후 <b style={{ color: "#e98a86" }}>명시적 저평점(★{w.rating != null ? w.rating.toFixed(1) : "—"})</b>만 시간 기회비용(P&amp;L regret)으로 기록됩니다.
          <b style={{ color: "var(--ink)" }}> 관람은 NAV를 깎지 않는다</b> — 보유 NAV는 단조 보존.
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-coin" /> 이 포지션 지표</h4>
        <div className="kv"><span>V 획득가치</span><b>{w.v != null ? Math.round(w.v) : "—"}</b></div>
        <div className="kv"><span>R 위험 (--risk)</span><b style={{ color: w.r != null && w.r >= 29 ? "var(--risk)" : "var(--ink)" }}>{w.r != null ? Math.round(w.r) : "—"}</b></div>
        <div className="kv"><span>S 샤프 · 위험조정</span><b>{s != null ? s.toFixed(2) : "—"}</b></div>
      </div>
    </div>
  );
}

/** 고위험 매수 경고 (Cinecodex R 높은 후보) → regret과 다름: 매수 전 R 예보. */
function RiskInsp({ f, lam }: { f: Rec; lam: number }) {
  const u = utilityU(f, lam);
  const s = sharpeS(f);
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div>
          <div className="seltitle ser">{f.title}</div>
          <div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""} · 후보 · 고위험</div>
        </div>
      </div>
      <div className="icard cc-card"><h4><i className="ti ti-alert-triangle" /> 고위험 매수 경고 · Cinecodex R</h4>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 30, color: "#ff8f6b" }}>{f.r != null ? Math.round(f.r) : "—"}</span><div style={{ fontSize: 9, color: "var(--sub)" }}>R 위험</div></div>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 22, color: (u ?? 0) >= 25 ? "#e0bb6e" : "#ff8f6b" }}>{u ?? "—"}</span><div style={{ fontSize: 9, color: "var(--sub)" }}>U 순가치 (λ{lam})</div></div>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 22, color: (s ?? 0) >= 1 ? "#7fbfa8" : "#ff8f6b" }}>{s != null ? s.toFixed(2) : "—"}</span><div style={{ fontSize: 9, color: "var(--sub)" }}>S 샤프</div></div>
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-info-circle" /> regret ≠ 위험(R)</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          이 경고는 <b style={{ color: "var(--ink)" }}>매수 전</b> Cinecodex 위험(R {f.r != null ? Math.round(f.r) : "—"})이 높은 후보의 사전 예보입니다 — 이미 관람 후 저평점인 regret과 다릅니다.
          위험(R)은 <span style={{ color: "var(--risk)" }}>--risk 오렌지</span>로, 완파(정복) <span style={{ color: "var(--red)" }}>red</span>와 반드시 구분합니다.
        </div>
      </div>
      <CinecodexCard d={{ v: f.v, c: null, r: f.r, u, prestige: f.prestige, discovery: f.disc, conf: f.conf, tier: f.tier }} slug={f.slug} />
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function DeskWorkspace({ data }: { data: DeskData }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const supabase = useMemo(() => createClient(), []);

  const [lam, setLam] = useState(1.0);                       // 위험회피 계수 λ — U=V−λR
  const [sort, setSort] = useState<"wwi" | "u" | "s" | "delta">("wwi"); // 정렬 기준
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ── 쓰기 경로 (real mutations — watchlist와 동일 RPC) ── */
  const doKeep = useCallback(async (f: Rec) => {
    const { error } = await supabase.rpc("me_set_watchlist", { p_slug: f.slug, p_on: true });
    say(error ? `저장 실패 — ${error.message}` : `「${f.title}」 볼 영화에 담김 · 저장됨`);
  }, [supabase, say]);

  const doSeen = useCallback(async (f: Rec) => {
    const { error } = await supabase.rpc("me_mark_seen", { p_slug: f.slug });
    say(error ? `기록 실패 — ${error.message}` : `「${f.title}」 관람 기록됨 · NAV 스냅샷 적재`);
  }, [supabase, say]);

  const recs = useMemo(() => data.recs.map(normRec), [data.recs]);
  const watched = useMemo(() => data.watched.map(normWatched), [data.watched]);

  /* ── 자산곡선 실데이터 (me_nav_history — 스냅샷 + 오늘 라이브) ── */
  const navPts = useMemo(() => data.navHistory
    .map((p) => ({ day: p.day, nav: num(p.nav) }))
    .filter((p): p is { day: string; nav: number } => p.nav != null), [data.navHistory]);
  // NAV 단조 어서션 — 관람은 NAV를 깎지 않는다(공식이 단조). 위반은 렌더 전 개발 경고.
  useEffect(() => {
    for (let i = 1; i < navPts.length; i++) {
      if (navPts[i].nav < navPts[i - 1].nav) {
        console.warn("[desk] NAV monotonicity violated in snapshots:", navPts[i - 1], navPts[i]);
      }
    }
  }, [navPts]);

  /* ── S1 「오늘의 한 편」 = 최대 Δ overall (tie → 최대 wwi) ── */
  const today = useMemo(() => {
    if (!recs.length) return null;
    return [...recs].sort((a, b) => (b.delta ?? -1) - (a.delta ?? -1) || (b.wwi ?? -1) - (a.wwi ?? -1))[0];
  }, [recs]);

  /* ── sort comparator (λ/S/Δ aware) ── */
  const sortKey = (r: Rec): number => {
    if (sort === "u") return utilityU(r, lam) ?? -999;
    if (sort === "s") return sharpeS(r) ?? -999;
    if (sort === "delta") return r.delta ?? -999;
    return r.wwi ?? -999; // wwi
  };

  /* ── bucket candidates into the 5 strategies by reasons[] (a candidate appears under each
     reason it carries; cap 4 per strategy, sorted by current key). REAL — no fabrication. ── */
  const buckets = useMemo(() => {
    const out: Record<string, Rec[]> = {};
    for (const strat of STRATS) {
      const list = recs.filter((r) => r.reasons.includes(strat.code));
      list.sort((a, b) => sortKey(b) - sortKey(a));
      out[strat.key] = list.slice(0, 4);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs, sort, lam]);

  /* max delta per bucket → alpha flag on that single top-Δ card */
  const alphaSlug = today?.slug ?? null;

  /* ── P&L (REAL from me_watched_scored) ── only LOW-rated (★≤2.0) count as regret ── */
  const scored = useMemo(() => watched.filter((w) => w.rating != null), [watched]);
  const hits = useMemo(() => scored.filter((w) => (w.rating ?? 0) >= 3.5), [scored]);
  const regrets = useMemo(() =>
    scored.filter((w) => (w.rating ?? 99) <= 2.0).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0)),
    [scored]);
  const nWatched = scored.length;
  const hitRate = nWatched ? Math.round((hits.length / nWatched) * 100) : null;
  const avgRating = nWatched
    ? scored.reduce((a, w) => a + (w.rating ?? 0), 0) / nWatched
    : null;

  /* ── summary (avg_v/avg_r + best/riskiest 배선) ── */
  const avgV = num(data.summary?.avg_v);
  const avgR = num(data.summary?.avg_r);
  const best = data.summary?.best ?? null;
  const riskiest = data.summary?.riskiest ?? null;

  /* ── 고위험 매수 경고 = 후보 중 R 높은 상위 (매수 전 예보, regret과 구분) ── */
  const riskWarn = useMemo(() =>
    [...recs].filter((r) => r.r != null && r.r >= 29).sort((a, b) => (b.r ?? 0) - (a.r ?? 0)).slice(0, 3),
    [recs]);

  /* ── strategy mix counts (real; a film may appear in several) ── */
  const mix = useMemo(() => STRATS.map((s) => ({ ...s, count: recs.filter((r) => r.reasons.includes(s.code)).length })), [recs]);

  const openRec = (f: Rec) => { setSel(f.slug); insp.select(<RecInsp f={f} lam={lam} onKeep={doKeep} onSeen={doSeen} />, `${f.title} · 추천`); };
  const openRegret = (w: Watched) => { setSel(w.slug); insp.select(<RegretInsp w={w} />, `${w.title} · regret`); };
  const openRisk = (f: Rec) => { setSel(f.slug); insp.select(<RiskInsp f={f} lam={lam} />, `${f.title} · 고위험`); };

  /* ── default inspector = 데스크 요약 (mirrors WatchlistWorkspace setDefault) ── */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-layout-board" /> 오늘의 5전략 mix</h4>
          {mix.map((m) => (
            <div className="kv" key={m.key}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block", flex: "0 0 auto" }} />{m.name} <span style={{ color: "var(--sub)", fontSize: 9.5 }}>{m.code}</span></span><b>{m.count}</b></div>
          ))}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, lineHeight: 1.5 }}>한 영화는 다중 이유를 보유 — 같은 후보가 여러 전략 칼럼에 등장할 수 있습니다. 카드를 클릭해 포지션을 분석하세요.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-chart-line" /> P&amp;L 요약 · 적중 vs regret</h4>
          <div className="bigscore" style={{ color: "var(--safe)", fontSize: 26 }}>{hitRate != null ? `${hitRate}%` : "형성 중"}</div>
          <div style={{ fontSize: 10, color: "var(--sub)", letterSpacing: ".05em", margin: "2px 0 8px" }}>적중률 · 높게 준(★3.5+) 추천 비율</div>
          <div className="kv"><span>관람 · 평가</span><b>{nWatched}</b></div>
          <div className="kv"><span>★3.5+ 적중</span><b style={{ color: "#5fd0b2" }}>{hits.length}</b></div>
          <div className="kv"><span>저평점 regret (★≤2.0)</span><b style={{ color: "#e98a86" }}>{regrets.length}</b></div>
          {best ? <div className="kv"><span>최고 순가치 보유 (TS {num(best.ts) ?? "—"})</span><b style={{ color: "#5fd0b2" }}>{best.title}</b></div> : null}
          {riskiest ? <div className="kv"><span>최고 위험 보유 (R {num(riskiest.r) ?? "—"})</span><b style={{ color: "var(--risk)" }}>{riskiest.title}</b></div> : null}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, lineHeight: 1.5 }}><i className="ti ti-shield-check" style={{ color: "var(--safe)" }} /> <b style={{ color: "var(--ink)" }}>관람은 NAV를 깎지 않는다.</b> 저평점만 P&amp;L regret으로 분리 기록 — NAV drawdown이 아닙니다.</div>
        </div>
        <div className="icard cc-card"><h4><i className="ti ti-hexagon" /> Cinecodex ⑨ · 위험조정 렌즈</h4>
          <div style={{ fontSize: 10.5, color: "var(--sub)", lineHeight: 1.55 }}>정전가(②)와 <b style={{ color: "#f0a58c" }}>나란히</b> 서는 두 번째 객관축 — 절대 안 섞음. 후보 카드에 <span className="dk-rbadge" style={{ verticalAlign: 0 }}>R</span> 위험 · <span className="dk-sbadge" style={{ color: "#7fbfa8" }}>샤프</span>. 상단 <b style={{ color: "var(--risk)" }}>λ 다이얼</b>이 U=V−λR로 재정렬합니다.</div>
          <div className="kv" style={{ marginTop: 8 }}><span>λ 현재</span><b style={{ color: "var(--risk)" }}>{lam}</b></div>
          <div className="kv"><span>정렬</span><b>{sort === "s" ? "S 샤프" : sort === "u" ? "U 순가치" : sort === "delta" ? "Δindex" : "WWI"}</b></div>
          <div className="kv"><span>고위험 후보 (R≥29)</span><b style={{ color: "#ff8f6b" }}>{riskWarn.length}</b></div>
        </div>
        <div className="emptyins">전략 카드 · regret · 고위험 경고를 클릭하면 여기에 상세 · 왜가 열립니다.</div>
      </div>
    );
  }, [data, lam, sort, mix, hitRate, nWatched, hits.length, regrets.length, riskWarn.length, setDefault]);

  const forming = nWatched === 0 && recs.length === 0;
  const lamNote = `U = V − ${lam === 1 ? "1" : lam}·R`;

  return (
    <div className="mainpad">
      <h1 className="secttl">운용 데스크 · Asset Desk</h1>
      <p className="secsub">
        다음 한 편을 고르는 <b style={{ fontStyle: "normal", color: "var(--ink)" }}>5-전략 추천 데스크</b> — <span className="gloss" title="λ 위험회피 다이얼: 순가치 U=V−λR의 위험 벌점 계수. 보수(λ2)는 고위험작을 강등, 모험(λ0.5)은 위험을 거의 무시.">λ 다이얼</span>로 보수↔모험, <span className="gloss" title="S 샤프 = (V−50)/max(R,1). 위험 대비 획득가치 효율.">S 샤프</span>로 위험조정 정렬. 아래 <span className="gloss" title="P&L(손익): 추천 적중과 저평점 regret을 분리 기록하는 손익 장부. NAV와 별개.">P&amp;L</span>은 실측 — <b style={{ fontStyle: "normal", color: "var(--ink)" }}>관람은 NAV를 깎지 않고 저평점만 regret</b>.
      </p>

      {/* ═══ HERO · 자산 요약 (NAV context + P&L split) ═══ */}
      <div className="dk-hero">
        <div className="dk-navbig">
          <div className="dk-navmeta">
            <div className="eb">운용 데스크 · 포트폴리오</div>
            <div className="dk-lvl"><span style={{ color: hitRate != null ? "var(--safe)" : "var(--forming)" }}>●</span> 적중률 {hitRate != null ? `${hitRate}%` : "형성 중"}</div>
            <div className="dk-pctl">관람 <b>{nWatched}</b> · ★3.5+ 적중 <b>{hits.length}</b> · <span className="rg">regret {regrets.length}</span> (P&amp;L 별도)</div>
          </div>
        </div>
        <div className="dk-components">
          <div className="dk-comp"><span className="cl">평균 별점</span><div className="ct"><i style={{ width: `${avgRating != null ? Math.round((avgRating / 5) * 100) : 0}%`, background: "var(--canon)" }} /></div><span className="cv">{avgRating != null ? avgRating.toFixed(1) : "—"}</span></div>
          <div className="dk-comp"><span className="cl">평균 V (획득)</span><div className="ct"><i style={{ width: `${avgV != null ? Math.round(avgV) : 0}%`, background: "var(--safe)" }} /></div><span className="cv">{avgV != null ? Math.round(avgV) : "—"}</span></div>
          <div className="dk-comp"><span className="cl">평균 R (위험)</span><div className="ct"><i style={{ width: `${avgR != null ? Math.min(100, Math.round(avgR * 2)) : 0}%`, background: "var(--risk)" }} /></div><span className="cv">{avgR != null ? Math.round(avgR) : "—"}</span></div>
          <div className="dk-comp"><span className="cl">후보 대기</span><div className="ct"><i style={{ width: `${Math.min(100, recs.length * 2)}%`, background: "var(--frontier)" }} /></div><span className="cv">{recs.length}</span></div>
        </div>
        <div className="dk-explain"><i className="ti ti-shield-check" style={{ color: "var(--safe)" }} /> <b style={{ color: "var(--ink)" }}>NAV는 단조 증가 — 관람으로 절대 내려가지 않는다.</b> <span style={{ color: "#e98a86" }}>저평점만</span> 아래 P&amp;L에 regret으로 분리 기록(NAV 불변).</div>
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div className="dk-kpis">
        <div className="dk-kpi dk-kpi-go" onClick={() => today && openRec(today)} title="추천 데스크로 이동">
          <div className="eb" style={{ color: "var(--red)" }}>오늘의 한 편</div>
          <div className="v" style={{ color: "var(--safe)" }}>+{today?.delta ?? 0}<small> Δ→NAV</small></div>
          <div className="d dk-flat">{today ? `${today.title} · 최대 알파` : "형성 중"}</div>
        </div>
        <div className="dk-kpi"><div className="eb">적중률 Hit</div><div className="v dk-up">{hitRate != null ? hitRate : "—"}<small>%</small></div><div className="d dk-flat">높게 준(★3.5+) 비율</div></div>
        <div className="dk-kpi"><div className="eb">P&amp;L regret</div><div className="v dk-dn">{regrets.length ? `−${regrets.length}` : "0"}</div><div className="d dk-dn">저평점(★≤2.0) · NAV 불변</div></div>
        <div className="dk-kpi"><div className="eb">확신 추천 대기</div><div className="v" style={{ color: "var(--red)" }}>{recs.filter((r) => r.reasons.length >= 3).length}</div><div className="d dk-flat">이유 3+ 종목</div></div>
        <div className="dk-kpi"><div className="eb">고위험 후보</div><div className="v">{riskWarn.length}</div><div className="d dk-dn">R≥29 · λ로 강등</div></div>
      </div>

      {/* ═══ STRATEGY DESK · 5 전략 (PRIME) ═══ */}
      <div className="dk-mod prime">
        <div className="dk-modh">
          <h3><i className="ti ti-layout-board" /> 다음 한 편을 고르세요 · 5 전략 추천</h3>
          <div className="dk-lam">
            <span className="llab"><i className="ti ti-adjustments-horizontal" /><span className="gloss" title="λ 위험회피 다이얼: 순가치 U=V−λR의 위험 벌점 계수. 보수(λ2)는 고위험작을 강등, 모험(λ0.5)은 위험을 거의 무시하고 획득가치 V 우선.">λ</span></span>
            <div className="dk-lamseg">
              {([[2, "보수", "λ2"], [1, "중립", "λ1"], [0.5, "모험", "λ.5"]] as [number, string, string][]).map(([v, l, lv]) => (
                <button key={lv} className={lam === v ? "on" : ""} onClick={() => setLam(v)}>{l}<span className="lv">{lv}</span></button>
              ))}
            </div>
            <span className="dk-lamnote">{lamNote}</span>
          </div>
          <div className="dk-seg" style={{ marginLeft: "auto" }}>
            {([["wwi", "WWI"], ["u", "U 순가치"], ["s", "S 샤프"], ["delta", "Δ"]] as [typeof sort, string][]).map(([v, l]) => (
              <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="dk-prime-hint"><i className="ti ti-hand-finger" /> 이 데스크가 오늘의 <b>주 작업</b>입니다 — 카드를 누르면 <b>Cinecodex(⑨)</b> 분석. λ·S로 위험조정 정렬.</div>
        <div className="dk-modbody">
          <div className="dk-strat">
            {STRATS.map((strat) => {
              const cards = buckets[strat.key] ?? [];
              return (
                <div className="dk-stcol" key={strat.key}>
                  <div className="dk-sthd"><span className="sd" style={{ background: strat.color }} /><span className="snm">{strat.name}</span><span className="sct">{strat.code}</span></div>
                  <div className="dk-stsub">{strat.sub}</div>
                  <div className="dk-stbody">
                    {cards.length ? cards.map((f) => {
                      const u = utilityU(f, lam);
                      const s = sharpeS(f);
                      const hi = sort === "s" || lam >= 2 ? (f.r != null && f.r >= 29) : false;
                      const primary = reasonChips(f.reasons)[0];
                      const isAlpha = f.slug === alphaSlug;
                      const shown = sort === "u" ? u : sort === "s" ? (s != null ? s.toFixed(1) : "—") : sort === "delta" ? f.delta : f.wwi;
                      return (
                        <div key={f.slug} className={`dk-pcard${sel === f.slug ? " sel" : ""}${isAlpha ? " alpha" : ""}${hi ? " hirisk-flag" : ""}`} onClick={() => openRec(f)}>
                          {isAlpha ? <div className="dk-alphatag"><i className="ti ti-star-filled" />오늘의 한 편 · 최대 Δ · → NAV +{f.delta ?? 0}</div> : null}
                          <div className="pt">{f.title}<span className="wn" style={{ color: sort === "wwi" ? wwiColor(f.wwi) : "var(--ink)" }}>{shown ?? "—"}</span></div>
                          <div className="pyr">{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</div>
                          <div className="pft"><span className={`dk-rsn ${primary.cls}`}>{primary.label}</span><span className="pdl">→ NAV +{f.delta ?? 0}</span></div>
                          <div className="crisk">
                            {f.r != null ? <span className={`dk-rbadge${riskBadgeCls(f.r)}`}>{Math.round(f.r)}</span> : <span className="dk-rbadge na">미평가</span>}
                            {s != null ? <span className="dk-sbadge">{s.toFixed(2)}</span> : null}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="dk-stempty"><span className="fm"><i className="ti ti-seedling" style={{ fontSize: 9 }} />형성 중</span><div>{strat.empty}</div></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ P&L / NAV PANEL ═══ */}
      <div className="dk-mod">
        <div className="dk-modh"><h3><i className="ti ti-chart-line" /> P&amp;L · 자산곡선 · 적중률 · regret</h3>
          <span className="meta">관람 ≠ NAV drawdown · 저평점만 regret</span></div>
        <div className="dk-modbody">
          <div className="dk-pnlgrid">

            {/* asset curve — me_nav_history 실데이터 (nav_snapshots + 오늘 라이브, 합성 없음) */}
            <div className="dk-pnlcard">
              <h5><i className="ti ti-trending-up" /> 자산곡선 · NAV over time</h5>
              {navPts.length >= 2 ? (() => {
                const X0 = 40, X1 = 422, Y0 = 14, Y1 = 168;
                const n = navPts.length;
                const xAt = (i: number) => X0 + (i / (n - 1)) * (X1 - X0);
                const yAt = (v: number) => Y1 - (Math.max(0, Math.min(100, v)) / 100) * (Y1 - Y0);
                const pts = navPts.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.nav).toFixed(1)}`).join(" ");
                const last = navPts[n - 1];
                const fmtD = (d: string) => d.slice(5).replace("-", ".");
                return (
                  <div className="dk-curveempty">
                    <svg viewBox="0 0 440 200" width="100%" role="img" aria-label={`NAV 자산곡선 — ${n}개 실측 스냅샷`}>
                      <line x1={X0} y1={Y1} x2="425" y2={Y1} stroke="#2c2c30" />
                      <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="#2c2c30" />
                      {[25, 50, 75, 100].map((g) => (
                        <g key={g}>
                          <line x1={X0} y1={yAt(g)} x2={X1} y2={yAt(g)} stroke="#232327" strokeDasharray="3 5" />
                          <text x={X0 - 5} y={yAt(g) + 3} textAnchor="end" fontSize="8" fill="#6C6960">{g}</text>
                        </g>
                      ))}
                      <polyline points={pts} fill="none" stroke="var(--safe)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                      {navPts.map((p, i) => (
                        <circle key={p.day} cx={xAt(i)} cy={yAt(p.nav)} r={i === n - 1 ? 4 : 2.5} fill="var(--safe)">
                          <title>{p.day} · NAV {Math.round(p.nav)}</title>
                        </circle>
                      ))}
                      <text x={xAt(n - 1) - 6} y={yAt(last.nav) - 9} textAnchor="end" fontSize="10" fill="#ECEAE5" fontFamily="ui-monospace,monospace">NAV {Math.round(last.nav)}</text>
                      <g fontSize="8.5" fill="#6C6960">
                        <text x={X0} y="184">{fmtD(navPts[0].day)}</text>
                        <text x="215" y="184" textAnchor="middle">시간</text>
                        <text x="390" y="184" textAnchor="end">{fmtD(last.day)}</text>
                      </g>
                    </svg>
                  </div>
                );
              })() : (
                <div className="dk-curveempty">
                  <svg viewBox="0 0 440 200" width="100%" role="img" aria-label="NAV 자산곡선 — 스냅샷 누적 시작, 형성 중">
                    <line x1="40" y1="168" x2="425" y2="168" stroke="#2c2c30" />
                    <line x1="40" y1="14" x2="40" y2="168" stroke="#2c2c30" />
                    {navPts.length === 1 ? (
                      <>
                        <circle cx="231" cy={168 - (Math.max(0, Math.min(100, navPts[0].nav)) / 100) * 154} r="4" fill="var(--safe)" />
                        <text x="231" y={168 - (Math.max(0, Math.min(100, navPts[0].nav)) / 100) * 154 - 10} textAnchor="middle" fontSize="10" fill="#ECEAE5" fontFamily="ui-monospace,monospace">NAV {Math.round(navPts[0].nav)}</text>
                      </>
                    ) : (
                      <line x1="40" y1="140" x2="422" y2="140" stroke="#3a3a40" strokeWidth="1.5" strokeDasharray="5 5" />
                    )}
                    <g fontSize="8.5" fill="#6C6960"><text x="40" y="184">—</text><text x="215" y="184">시간</text><text x="390" y="184">—</text></g>
                  </svg>
                  <div className="badge">
                    <span className="fm"><i className="ti ti-seedling" style={{ fontSize: 10 }} />형성 중 · 스냅샷 누적 시작</span>
                    <span className="sub">평가·관람이 기록될 때마다 그날의 NAV 스냅샷이 쌓입니다 — 점이 2개 이상 모이면 실측 곡선이 그려집니다(지어내지 않음).</span>
                  </div>
                </div>
              )}
              <div className="dk-navguard"><i className="ti ti-shield-check" /><span><b>관람은 NAV를 깎지 않는다.</b> 곡선은 실측 스냅샷만 — 저평점은 아래 regret에만 기록되고 NAV는 불변(단조 어서션 포함).</span></div>
            </div>

            {/* hit rate + regret (REAL from me_watched_scored) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div className="dk-pnlcard">
                <h5><i className="ti ti-target" /> 적중률 Hit Rate</h5>
                <div className="dk-hitbig"><span className="n">{hitRate != null ? hitRate : "—"}<span style={{ fontSize: 15 }}>%</span></span><span className="u">내가 높게 준(★3.5+) 비율</span></div>
                <div className="dk-pstat"><span className="k">관람 · 평가</span><span className="v">{nWatched}</span></div>
                <div className="dk-pstat"><span className="k">★3.5+ 적중</span><span className="v" style={{ color: "#5fd0b2" }}>{hits.length}</span></div>
                <div className="dk-pstat"><span className="k">저평점 regret (★≤2.0)</span><span className="v" style={{ color: "#e98a86" }}>{regrets.length}</span></div>
                <div className="dk-ministats" style={{ marginTop: 9 }}>
                  <div className="dk-ministat"><div className="n">{avgRating != null ? avgRating.toFixed(1) : "—"}</div><div className="l">평균 별점</div></div>
                  <div className="dk-ministat"><div className="n">{nWatched}</div><div className="l">관람 수</div></div>
                </div>
              </div>

              <div className="dk-pnlcard">
                <h5><i className="ti ti-mood-sad" /> P&amp;L Regret · 회수 실패 (★≤2.0)</h5>
                {regrets.length ? regrets.map((w) => (
                  <div className="dk-regret" key={w.slug}>
                    <span className="rgnm" onClick={() => openRegret(w)}>{w.title} <small>{w.year ?? ""}{w.director ? ` · ${w.director}` : ""}</small></span>
                    <span className="rgst">★{w.rating != null ? w.rating.toFixed(1) : "—"}</span>
                    <span className="rgpl">−1</span>
                  </div>
                )) : (
                  <div style={{ fontSize: 11, color: "var(--sub)", padding: "6px 0", lineHeight: 1.5 }}>
                    <i className="ti ti-shield-check" style={{ color: "var(--safe)" }} /> 저평점(★≤2.0) 회수 실패 없음 — 지금까지 모든 관람이 최소 기준을 넘겼습니다.
                  </div>
                )}
                <div className="dk-navguard"><i className="ti ti-shield-check" /><span>이 regret은 <b>시간 기회비용</b>일 뿐 — <b style={{ color: "#5fd0b2" }}>보유 NAV는 불변</b>. 단순 관람은 절대 페널티가 아닙니다.</span></div>

                {/* 고위험 매수 경고 (Cinecodex R) — regret과 다름 */}
                {riskWarn.length ? (
                  <div className="dk-riskwarn">
                    <h5><i className="ti ti-alert-triangle" /> 고위험 매수 경고 · Cinecodex R</h5>
                    {riskWarn.map((f) => {
                      const u = utilityU(f, lam);
                      const s = sharpeS(f);
                      return (
                        <div className="dk-rwrow" key={f.slug} onClick={() => openRisk(f)}>
                          <span className="rwnm">{f.title} <small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""} · 후보</small></span>
                          <span className={`dk-rbadge${riskBadgeCls(f.r)}`}>{f.r != null ? Math.round(f.r) : "—"}</span>
                          <span className="rwu">U {u ?? "—"} · S {s != null ? s.toFixed(1) : "—"}</span>
                        </div>
                      );
                    })}
                    <div className="dk-rwfoot"><i className="ti ti-info-circle" /><span><b>regret ≠ 위험(R).</b> Regret은 <i>이미 관람 후 저평점</i>, 이 경고는 <i>매수 전</i> Cinecodex 위험(R)이 높은 후보의 사전 예보 — 완파 <span style={{ color: "var(--red)" }}>red</span> ≠ 위험 <span style={{ color: "var(--risk)" }}>orange</span>.</span></div>
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      </div>

      {toast ? (
        <div role="status" style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 90,
          background: "#1c1c20", border: "1px solid #3a3a40", color: "var(--ink, #ECEAE5)",
          padding: "9px 16px", borderRadius: 8, fontSize: 12, boxShadow: "0 6px 22px rgba(0,0,0,.5)",
        }}>{toast}</div>
      ) : null}
    </div>
  );
}
