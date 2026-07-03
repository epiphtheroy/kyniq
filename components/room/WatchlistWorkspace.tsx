"use client";
/** 볼 영화 (v2 데일리 루프) — 담아둔 것 먼저, 그 아래 추천.
 *  연계 3원칙: 같은 행(FilmRow) · 같은 인스펙터(RecInsp) · 같은 mutation(useRoomActions).
 *  서버 정렬(me_recommend_wwi)을 그대로 신뢰 — 클라 재계산 없음, 적합도(wwi)만 표시.
 *  담김은 in_watchlist 시딩 + 세션 낙관적 추가, 봤어요/관심없음/평점⟹봤어요는 gone으로 즉시 제거. */
import { useMemo, useState, useEffect, useCallback } from "react";
import { useInspector } from "./InspectorContext";
import RecInsp, { type RecFilm } from "./RecInsp";
import FilmRow from "./FilmRow";
import { useRoomActions } from "./useRoomActions";

/* RPC row (PostgREST numerics may arrive as strings → num() 코어스 필수) */
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; ts: number | string | null;
  prestige: number | string | null; conf: number | string | null; tier: string | null;
  sim: number | string | null; u_util: number | string | null; t_taste: number | string | null;
  s_standing: number | string | null; wwi: number | string | null; disc: number | string | null;
  reasons: string[] | null; avail: { state: string; provider?: string } | null;
  delta: number | string | null; in_watchlist?: boolean | null;
};

const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

/* 6+가용 이유 정본 (칩 라벨) — reasons 없으면 칩 미표시, fallback 지어내지 않음 */
const REASON_MAP: Record<string, { cls: string; label: string }> = {
  safe: { cls: "safe", label: "안전자산" },
  reading: { cls: "reading", label: "취향 적중" },
  canon: { cls: "canon", label: "정전 위상" },
  gap: { cls: "gap", label: "공백 충족" },
  frontier: { cls: "frontier", label: "안전한 모험" },
  conquer: { cls: "conquer", label: "도장깨기" },
};
function firstChip(reasons: string[] | null): { cls: string; label: string } | null {
  const c = reasons?.[0];
  return c ? REASON_MAP[c] ?? null : null;
}

function toRecFilm(f: WwiRow, kept: boolean): RecFilm {
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons,
    v: num(f.v), r: num(f.r),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier,
    kept,
  };
}

export default function WatchlistWorkspace({ rows }: { rows: WwiRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { doKeep, doSeen, doDismiss, doRate, toast } = useRoomActions();

  const [q, setQ] = useState("");
  const [hideRisk, setHideRisk] = useState(false);
  // 담김/제거는 낙관적 UI — 서버 상태(in_watchlist)로 시딩되어 새로고침에도 유지
  const [kept, setKept] = useState<Set<string>>(() => new Set(rows.filter((r) => r.in_watchlist).map((r) => r.slug)));
  const [gone, setGone] = useState<Set<string>>(new Set());

  /* ── 같은 mutation (useRoomActions) + 낙관적 Set (실패 시 롤백 — 토스트가 실패를 알림) ── */
  const handleKeep = useCallback(async (f: WwiRow) => {
    setKept((s) => new Set(s).add(f.slug));
    const ok = await doKeep(f.slug, f.title);
    if (!ok) setKept((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doKeep]);
  const handleSeen = useCallback(async (f: WwiRow) => {
    setGone((s) => new Set(s).add(f.slug));
    insp.close();
    const ok = await doSeen(f.slug, f.title);
    if (!ok) setGone((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doSeen, insp]);
  const handleDismiss = useCallback(async (f: WwiRow) => {
    setGone((s) => new Set(s).add(f.slug));
    insp.close();
    const ok = await doDismiss(f.slug, f.title);
    if (!ok) setGone((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doDismiss, insp]);
  const handleRate = useCallback(async (f: WwiRow, v: number) => {
    const row = await doRate(f.slug, f.title, v);
    if (row) setGone((s) => new Set(s).add(f.slug)); // 평점 ⟹ 봤어요 → 목록에서 제거
  }, [doRate]);

  /* ── 담아둔 영화 (서버 정렬 유지) ── */
  const keptList = useMemo(
    () => rows.filter((f) => kept.has(f.slug) && !gone.has(f.slug)),
    [rows, kept, gone],
  );

  /* ── 추천 후보: kept·gone 제외 → 검색/고위험 필터 → wwi desc 상위 20 ── */
  const pool = useMemo(() => rows.filter((f) => !kept.has(f.slug) && !gone.has(f.slug)), [rows, kept, gone]);
  const candidates = useMemo(() => {
    let a = pool;
    if (q.trim()) {
      const t = q.toLowerCase();
      a = a.filter((f) => f.title.toLowerCase().includes(t) || (f.director ?? "").toLowerCase().includes(t));
    }
    if (hideRisk) a = a.filter((f) => (num(f.r) ?? 0) < 26);
    return [...a].sort((x, y) => (num(y.wwi) ?? -1) - (num(x.wwi) ?? -1)).slice(0, 20);
  }, [pool, q, hideRisk]);

  const openFilm = useCallback((f: WwiRow, isKept: boolean) => {
    insp.select(
      <RecInsp f={toRecFilm(f, isKept)}
        onKeep={isKept ? undefined : () => handleKeep(f)}
        onSeen={() => handleSeen(f)}
        onDismiss={() => handleDismiss(f)}
        onRate={(_r, v) => { void handleRate(f, v); }} />,
      f.title,
    );
  }, [insp, handleKeep, handleSeen, handleDismiss, handleRate]);

  /* ── 앱바 「요약」용 기본 인스펙터 (자동으로 열리지 않음) ── */
  const hiCount = useMemo(() => pool.filter((f) => (num(f.r) ?? 0) >= 26).length, [pool]);
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-list-check" /> 볼 영화 요약</h4>
          <div className="kv"><span>추천 후보</span><b>{pool.length}</b></div>
          <div className="kv"><span>담아둔 영화</span><b style={{ color: "var(--safe)" }}>{keptList.length}</b></div>
          <div className="kv"><span>실망 위험 높음</span><b style={{ color: "var(--risk)" }}>{hiCount}</b></div>
        </div>
        <div className="emptyins">영화를 클릭하면 왜 이 추천인지가 열립니다. 담기·봤어요·관심없음은 즉시 저장됩니다.</div>
      </div>
    );
  }, [pool.length, keptList.length, hiCount, setDefault]);

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">볼 영화</h1>
        <p className="v2sub">담아둔 것 먼저, 그 아래 추천 — 이유는 클릭하면 열립니다.</p>
      </div>

      {/* ═══ 담아둔 영화 ═══ */}
      {keptList.length ? (
        <section>
          <div className="v2h"><h3>담아둔 영화 ({keptList.length})</h3></div>
          {keptList.map((f) => (
            <FilmRow key={f.slug}
              f={{
                slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
                chip: firstChip(f.reasons), fit: num(f.wwi), risk: num(f.r), kept: true,
              }}
              onOpen={() => openFilm(f, true)}
              onSeen={() => handleSeen(f)}
              onDismiss={() => handleDismiss(f)} />
          ))}
        </section>
      ) : null}

      {/* ═══ 추천 후보 ═══ */}
      <section>
        <div className="v2h"><h3>추천 후보</h3></div>
        <div className="toolbar">
          <div className="srch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·감독 검색" /></div>
          <div className={`qtoggle${hideRisk ? " on" : ""}`} onClick={() => setHideRisk((v) => !v)}>
            <span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--risk)" }} /> 고위험 숨기기
          </div>
        </div>
        {candidates.length ? candidates.map((f) => (
          <FilmRow key={f.slug}
            f={{
              slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
              chip: firstChip(f.reasons), fit: num(f.wwi), avail: f.avail, risk: num(f.r),
            }}
            onOpen={() => openFilm(f, false)}
            onKeep={() => handleKeep(f)}
            onSeen={() => handleSeen(f)}
            onDismiss={() => handleDismiss(f)} />
        )) : (
          <div className="emptyins">후보가 없습니다 — 영화를 더 평가하면 채워집니다(★3.5+ 3편부터).</div>
        )}
      </section>

      {toast}
    </div>
  );
}
