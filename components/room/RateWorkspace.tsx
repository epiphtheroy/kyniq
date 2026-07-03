"use client";
/** /room/rate — 기록 · 평가 (v2 데일리 루프).
 *  검색→반별점 원스트로크(QuickRate)가 유일한 히어로 — 링/게이지/KPI 없음.
 *  REAL data: me_rate_stats(헤더 요약) · me_recent_ratings(최근 평가 그리드) ·
 *  me_taste_neighbors(★4+ 평가 직후 '닮은 결' fly-in — sim 수치는 화면 미노출).
 *  카드 클릭 → 공용 RecInsp(같은 인스펙터 원칙). mutation은 전부 useRoomActions 공유. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInspector } from "./InspectorContext";
import RecInsp, { type RecFilm } from "./RecInsp";
import QuickRate, { type QuickHit } from "./QuickRate";
import Stars from "./Stars";
import { useRoomActions } from "./useRoomActions";

export type RateStats = { rated: number; loved: number; seen: number; watchlist: number; session_new: number; forming: boolean; loved_target: number };
export type RecentRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; rating: number; loved: boolean; watched_at: string | null; added_at: string | null; v: number | null; r: number | null; prestige: number | null };
type NeighborRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; v: number | null; r: number | null; prestige: number | null; sim: number };

const IMG = "https://image.tmdb.org/t/p/w185";
/* PostgREST numerics can arrive as strings — always coerce. */
const num = (x: unknown): number | null => x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);
const fmtStar = (v: number | null) => (v == null || v <= 0 ? "—" : `${v % 1 ? v.toFixed(1) : v.toFixed(0)}★`);
const po = (p: string | null) => ({
  background: p ? `url(${IMG}${p}) center/cover` : "linear-gradient(145deg,#26262c,#151517)",
});
/* 최근 평가 행/이웃 행 → 공용 인스펙터 계약(RecFilm). reasons 없음 → RecInsp가 정직한 빈 문구를 보여준다. */
const toRecFilm = (f: { slug: string; title: string; year?: number | null; director?: string | null; poster_path?: string | null; rating?: number | null; v?: number | null; r?: number | null; prestige?: number | null }): RecFilm => ({
  slug: f.slug, title: f.title, year: num(f.year), director: f.director ?? null, poster_path: f.poster_path ?? null,
  rating: num(f.rating), v: num(f.v), r: num(f.r), prestige: num(f.prestige),
});

export default function RateWorkspace({ stats, recent }: { stats: RateStats; recent: RecentRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { supabase, doKeep, doRate, toast } = useRoomActions();

  // 낙관적 오버레이 — 방금 평가한 영화(신규/재평가)가 그리드 맨 앞으로
  const [fresh, setFresh] = useState<RecentRow[]>([]);
  const [neighbors, setNeighbors] = useState<NeighborRow[]>([]);

  // fresh 우선 + 서버 목록, slug dedup
  const merged = useMemo(() => {
    const out = [...fresh];
    const seen = new Set(out.map((r) => r.slug));
    for (const r of recent) if (!seen.has(r.slug)) { out.push(r); seen.add(r.slug); }
    return out;
  }, [fresh, recent]);

  /* 누적/loved는 서버 값 그대로(세션 로드 시점) — "최근 40개에 없으면 신규"식 추정 가산은
     40개 밖 재평가를 +1 과다 집계하므로 하지 않는다. 세션 활동은 별점 횟수로 정확하게만 표기. */
  const ratedN = num(stats.rated) ?? 0;
  const lovedN = num(stats.loved) ?? 0;
  const sessCount = fresh.length;
  const watchlistN = num(stats.watchlist) ?? 0;

  /* ── 평가 원스트로크: rate_film(useRoomActions) → 그리드 낙관적 prepend → ★4+면 이웃 fly-in ── */
  const rate = useCallback(async (f: { slug: string; title: string; year?: number | null; poster_path?: string | null; director?: string | null }, value: number) => {
    const res = await doRate(f.slug, f.title, value);
    if (!res) return;
    const rating = num(res.rating) ?? value;
    const prev = merged.find((r) => r.slug === f.slug);
    const row: RecentRow = {
      slug: f.slug, title: f.title,
      year: num(f.year) ?? prev?.year ?? null,
      poster_path: f.poster_path ?? prev?.poster_path ?? null,
      director: f.director ?? prev?.director ?? null,
      rating, loved: rating >= 4.5,
      watched_at: new Date().toISOString().slice(0, 10), added_at: new Date().toISOString(),
      v: prev?.v ?? null, r: prev?.r ?? null, prestige: prev?.prestige ?? null,
    };
    setFresh((list) => [row, ...list.filter((x) => x.slug !== f.slug)]);
    if (rating >= 4) {
      const { data } = await supabase.rpc("me_taste_neighbors", { p_limit: 4 });
      setNeighbors((data as NeighborRow[] | null) ?? []);
    }
  }, [doRate, supabase, merged]);

  /* ── 공용 인스펙터 — 최근 평가 카드 / 이웃 포스터 클릭 ── */
  const openFilm = useCallback((f: RecentRow) => {
    insp.select(<RecInsp f={toRecFilm(f)} onRate={(rf, v) => rate(rf, v)} />, f.title);
  }, [insp, rate]);

  const openNeighbor = useCallback((n: NeighborRow) => {
    insp.select(
      <RecInsp f={toRecFilm(n)} onKeep={(rf) => doKeep(rf.slug, rf.title)} onRate={(rf, v) => rate(rf, v)} />,
      n.title,
    );
  }, [insp, doKeep, rate]);

  /* ── 앱바 요약(자동으로 열리지 않음) ── */
  useEffect(() => {
    setDefault(
      <div className="icard"><h4><i className="ti ti-star" /> 기록 요약</h4>
        <div className="kv"><span>누적 평가 (세션 시작 기준)</span><b>{ratedN}</b></div>
        <div className="kv"><span>사랑함 (★4.5+)</span><b>{lovedN}</b></div>
        <div className="kv"><span>이번 세션 별점</span><b>{sessCount}회</b></div>
        <div className="kv"><span>볼 영화 후보</span><b>{watchlistN}</b></div>
      </div>
    );
  }, [setDefault, ratedN, lovedN, watchlistN]);

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">기록 · 평가</h1>
        <p className="v2sub">누적 {ratedN}편 · loved {lovedN}편{sessCount ? ` · 이번 세션 별점 ${sessCount}회` : ""} — 평점을 주면 자동으로 봤어요.</p>
      </div>

      <QuickRate onRate={(h: QuickHit, v) => rate(h, v)} />

      {neighbors.length ? (
        <section>
          <div className="v2h"><h3>닮은 결</h3></div>
          <div className="postrip">
            {neighbors.map((n) => (
              <div className="pcard" key={n.slug} onClick={() => openNeighbor(n)}>
                <div className="ppo" style={po(n.poster_path)} />
                <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--sub)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
              </div>
            ))}
          </div>
          <p className="v2sub" style={{ marginTop: 6 }}>방금 사랑한 작품과 해석적으로 닮은 미관람작입니다.</p>
        </section>
      ) : null}

      <section>
        <div className="v2h"><h3>최근 평가</h3></div>
        {merged.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
            {merged.map((f) => (
              <div key={f.slug} onClick={() => openFilm(f)} style={{ cursor: "pointer", minWidth: 0 }}>
                <div style={{ aspectRatio: "2/3", borderRadius: 6, border: "1px solid var(--line2)", ...po(f.poster_path) }} />
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
                  <Stars value={num(f.rating) ?? 0} size={15} onPick={(v) => rate(f, v)} />
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--sub)" }}>{fmtStar(num(f.rating))}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyins">아직 평가가 없습니다 — 위 검색창에서 본 영화를 찾아 별을 누르세요.</div>
        )}
      </section>

      {toast}
    </div>
  );
}
