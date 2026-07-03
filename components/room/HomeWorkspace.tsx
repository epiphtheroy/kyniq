"use client";
/** /room 홈 v2 — "오늘" 페이지 (데스크 흡수). 3초 계약: ①방금 본 것 기록 ②오늘 볼 한 편 ③자산 한 줄.
 *  모듈 순서: 헤더 → 퀵 기록 → 오늘의 한 편 → 최근 본 → 다음 후보 → 완파까지 N편 → 자산 한 줄.
 *  공용 기반 재사용: RecInsp(인스펙터 3카드) · FilmRow(행) · QuickRate(원스트로크 기록) · useRoomActions(mutation+토스트).
 *  불변식: no-fake-data(reasons 없으면 칩 없음) · 다음 후보 = 워치리스트 '추천 후보'와 동일 규칙(담김 제외·적합도 desc) = 허브 프리뷰 계약. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useInspector } from "./InspectorContext";
import RecInsp, { type RecFilm } from "./RecInsp";
import FilmRow from "./FilmRow";
import QuickRate, { type QuickHit } from "./QuickRate";
import { useRoomActions } from "./useRoomActions";

/* ── RPC 행 타입 (PostgREST numerics는 string으로 올 수 있음 → 전부 num() 코어스) ── */
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | string | null; r: number | string | null; ts: number | string | null;
  prestige: number | string | null; conf: number | string | null; tier: string | null;
  sim: number | string | null; u_util: number | string | null; t_taste: number | string | null;
  s_standing: number | string | null; wwi: number | string | null; disc: number | string | null;
  reasons: string[] | null; avail: { state: string; provider?: string } | null;
  delta: number | string | null; in_watchlist: boolean | null;
};
export type CovRow = {
  list_id: string; slug: string; label: string; facet: string;
  aw: number | string | null; seen: number | string | null; total: number | string | null;
  pct: number | string | null; state: string;
};
export type RecentRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null; loved: boolean | null; watched_at: string | null; added_at: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null;
};
export type RateStats = {
  rated: number | string | null; loved: number | string | null; seen: number | string | null;
  watchlist: number | string | null; session_new: number | string | null;
  forming: boolean | null; loved_target: number | string | null;
};
export type NavJson = {
  nav: number | string | null; n_watched: number | string | null; n_scored: number | string | null;
  essentials: number | string | null; avg_standing: number | string | null; lines: number | string | null;
} | null;
export type HomeData = { nav: NavJson; stats: RateStats | null; recs: WwiRow[]; coverage: CovRow[]; recent: RecentRow[] };

const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

const IMG342 = "https://image.tmdb.org/t/p/w342";
const IMG185 = "https://image.tmdb.org/t/p/w185";

// 이유 칩 정본 코드 6종 — 미등록 코드·reasons 없음 = 칩 미표시 (지어내지 않음)
const REASON_MAP: Record<string, { cls: string; label: string }> = {
  safe: { cls: "safe", label: "안전자산" },
  reading: { cls: "reading", label: "취향 적중" },
  canon: { cls: "canon", label: "정전 위상" },
  gap: { cls: "gap", label: "공백 충족" },
  frontier: { cls: "frontier", label: "안전한 모험" },
  conquer: { cls: "conquer", label: "도장깨기" },
};
const chipsOf = (f: WwiRow) => (f.reasons ?? []).map((c) => REASON_MAP[c]).filter(Boolean);

// facet 한국어 라벨 (me_coverage 실 facet)
const FACET_LABEL: Record<string, string> = { canon: "정전", award: "수상", national: "국가", auteur: "감독" };
// 다음 마일스톤: lock→50% · prog→75% · near→100% (done은 잔여 없음 → 제외)
const MILESTONE: Record<string, number> = { lock: 50, prog: 75, near: 100 };

const tierOf = (nav: number | null) =>
  nav == null ? "형성 중" : nav >= 90 ? "APEX" : nav >= 70 ? "ESTABLISHED" : nav >= 45 ? "BUILDING" : "FORMING";

/* WwiRow → 공용 인스펙터(RecInsp) 입력. λ=1.0 고정 화면이므로 U = V − R. */
function toRecFilm(f: WwiRow, kept: boolean): RecFilm {
  const v = num(f.v), r = num(f.r);
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons, v, c: null, r, u: v != null && r != null ? Math.round(v - r) : num(f.ts),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier, kept,
  };
}

type RecentCard = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; rating: number | null; v?: number | null; r?: number | null; prestige?: number | null };

export default function HomeWorkspace({ data }: { data: HomeData }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { doKeep, doSeen, doDismiss, doRate, toast } = useRoomActions();

  /* ── 낙관적 로컬 상태 — 담김은 서버(in_watchlist)로 시딩, 새로고침에도 유지 ── */
  const [kept, setKept] = useState<Set<string>>(() => new Set(data.recs.filter((r) => r.in_watchlist).map((r) => r.slug)));
  const [gone, setGone] = useState<Set<string>>(new Set());   // local seen/dismiss/rated
  const [cursor, setCursor] = useState(0);                     // 오늘의 한 편 회전(순환)
  const [extra, setExtra] = useState<RecentCard[]>([]);        // 퀵기록 낙관적 prepend
  const [reRated, setReRated] = useState<Record<string, number>>({}); // 최근 본 재평가 반영

  /* ── 쓰기 래퍼 (공용 mutation + 낙관적 UI — 실패 시 롤백, 행 소멸 액션은 인스펙터도 닫음) ── */
  const keep = useCallback(async (f: { slug: string; title: string }) => {
    setKept((s) => new Set(s).add(f.slug));
    const ok = await doKeep(f.slug, f.title);
    if (!ok) setKept((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doKeep]);
  const seen = useCallback(async (f: { slug: string; title: string }) => {
    setGone((s) => new Set(s).add(f.slug));
    insp.close();
    const ok = await doSeen(f.slug, f.title);
    if (!ok) setGone((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doSeen, insp]);
  const dismiss = useCallback(async (f: { slug: string; title: string }) => {
    setGone((s) => new Set(s).add(f.slug));
    insp.close();
    const ok = await doDismiss(f.slug, f.title);
    if (!ok) setGone((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doDismiss, insp]);
  /* 평점 ⟹ 봤어요: 후보에서 제거 + 최근 스트립에 즉시 prepend */
  const rateNew = useCallback((f: RecentCard, v: number) => {
    setGone((s) => new Set(s).add(f.slug));
    setExtra((a) => [{ ...f, rating: v }, ...a.filter((x) => x.slug !== f.slug)]);
    doRate(f.slug, f.title, v);
  }, [doRate]);
  const reRate = useCallback((f: { slug: string; title: string }, v: number) => {
    setReRated((m) => ({ ...m, [f.slug]: v })); doRate(f.slug, f.title, v);
  }, [doRate]);

  /* ── ③ 오늘의 한 편 — reasons ≥1 · 가용 on 우선(wwi desc), 없으면 wwi desc 1위. [다른 한 편]으로 순환. ── */
  const alive = useMemo(() => data.recs.filter((f) => !gone.has(f.slug)), [data.recs, gone]);
  const rotation = useMemo(() => {
    const w = (f: WwiRow) => num(f.wwi) ?? -1;
    const prime = alive.filter((f) => (f.reasons?.length ?? 0) > 0 && f.avail?.state === "on").sort((a, b) => w(b) - w(a));
    const ids = new Set(prime.map((f) => f.slug));
    const rest = alive.filter((f) => !ids.has(f.slug)).sort((a, b) => w(b) - w(a));
    return [...prime, ...rest];
  }, [alive]);
  const today = rotation.length ? rotation[((cursor % rotation.length) + rotation.length) % rotation.length] : null;

  const openRec = useCallback((f: WwiRow) => {
    insp.select(
      <RecInsp f={toRecFilm(f, kept.has(f.slug))} onKeep={() => keep(f)} onSeen={() => seen(f)}
        onDismiss={() => dismiss(f)} onRate={(_, v) => rateNew({ ...f, rating: null, v: num(f.v), r: num(f.r), prestige: num(f.prestige) }, v)} />,
      "인스펙터 · 후보");
  }, [insp, kept, keep, seen, dismiss, rateNew]);

  /* ── ④ 최근 본 — 서버 12장 + 낙관적 prepend (중복 slug 제거) ── */
  const strip = useMemo(() => {
    const seenIds = new Set<string>();
    const rows: RecentCard[] = [];
    for (const f of [...extra, ...data.recent.map((r) => ({
      slug: r.slug, title: r.title, year: r.year, poster_path: r.poster_path, director: r.director,
      rating: num(r.rating), v: num(r.v), r: num(r.r), prestige: num(r.prestige),
    }))]) {
      if (seenIds.has(f.slug)) continue;
      seenIds.add(f.slug); rows.push(f);
    }
    return rows;
  }, [extra, data.recent]);

  const openRecent = useCallback((f: RecentCard) => {
    insp.select(
      <RecInsp f={{ slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
        v: f.v ?? null, r: f.r ?? null, prestige: f.prestige ?? null, rating: reRated[f.slug] ?? f.rating }}
        onRate={(_, v) => reRate(f, v)} />,
      "인스펙터 · 최근 본");
  }, [insp, reRated, reRate]);

  /* ── ⑤ 다음 후보 — 워치리스트 '추천 후보' 섹션과 동일 규칙(담김 제외 · 적합도 desc) 상위 6
         = 허브 프리뷰 계약: 홈 리스트가 워치리스트 상위와 같은 순서로 이어진다 ── */
  const next6 = useMemo(
    () => data.recs
      .filter((f) => !gone.has(f.slug) && !kept.has(f.slug) && f.slug !== today?.slug)
      .sort((a, b) => (num(b.wwi) ?? -1) - (num(a.wwi) ?? -1))
      .slice(0, 6),
    [data.recs, gone, kept, today?.slug]);

  /* ── ⑥ 완파까지 — seen>0 계보의 다음 마일스톤 잔여, 잔여 오름차순 → aw desc, 상위 5 ── */
  const covRows = useMemo(() => {
    return data.coverage
      .map((c) => {
        const s = num(c.seen) ?? 0, t = num(c.total) ?? 0, ms = MILESTONE[c.state];
        if (s <= 0 || !ms || t <= 0) return null;
        const rem = Math.ceil((t * ms) / 100) - s;
        return rem > 0 ? { c, s, t, ms, rem, pct: Math.round(num(c.pct) ?? 0), aw: num(c.aw) ?? 0 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.rem - b.rem || b.aw - a.aw)
      .slice(0, 5);
  }, [data.coverage]);

  const openCov = useCallback((x: { c: CovRow; s: number; t: number; ms: number; rem: number; pct: number }) => {
    insp.select(
      <div>
        <div className="icard"><h4><i className="ti ti-flag" /> {x.c.label}</h4>
          <div className="kv"><span>계보</span><b>{FACET_LABEL[x.c.facet] ?? x.c.facet}</b></div>
          <div className="kv"><span>진행</span><b>{x.s} / {x.t}편 · {x.pct}%</b></div>
          <div className="kv"><span>다음 마일스톤 {x.ms}%까지</span><b>{x.rem}편</b></div>
          <div style={{ marginTop: 10 }}><a href={`/lineage/${x.c.slug}`} style={{ fontSize: 12, color: "var(--sub)" }}>계보 전체 보기 →</a></div>
        </div>
      </div>,
      "인스펙터 · 계보");
  }, [insp]);

  /* ── ⑦ 자산 한 줄 ── */
  const navV = num(data.nav?.nav ?? null);
  const tier = tierOf(navV);
  const openNav = useCallback(() => {
    insp.select(
      <div>
        <div className="icard"><h4><i className="ti ti-chart-line" /> 자산 성분</h4>
          <div className="kv"><span>계보 라인</span><b>{num(data.nav?.lines ?? null) ?? "—"}</b></div>
          <div className="kv"><span>평균 정전가</span><b>{num(data.nav?.avg_standing ?? null) != null ? Math.round(num(data.nav?.avg_standing ?? null)!) : "—"}</b></div>
          <div className="kv"><span>필수작</span><b>{num(data.nav?.essentials ?? null) ?? "—"}</b></div>
          <div className="kv"><span>평가 수</span><b>{num(data.nav?.n_scored ?? null) ?? "—"}</b></div>
        </div>
        <div className="emptyins">관람은 NAV를 깎지 않습니다 — 저평점도 자산을 줄이지 않습니다.</div>
      </div>,
      "인스펙터 · 자산");
  }, [insp, data.nav]);

  /* ── 페이지 요약(setDefault — 앱바 「요약」 버튼용, 자동으로 열리지 않음) ── */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-sun" /> 오늘 요약</h4>
          <div className="kv"><span>오늘의 한 편</span><b>{today?.title ?? "—"}</b></div>
          <div className="kv"><span>대기 후보</span><b>{alive.length}</b></div>
          <div className="kv"><span>NAV</span><b>{navV ?? "형성 중"}</b></div>
        </div>
      </div>
    );
  }, [setDefault, today?.title, alive.length, navV]);

  const todayChips = today ? chipsOf(today).slice(0, 2) : [];
  const todayFit = today ? num(today.wwi) : null;

  return (
    <div className="v2wrap">
      {/* ① 헤더 */}
      <div>
        <h1 className="v2title">오늘</h1>
        <p className="v2sub">기록 → 오늘 볼 한 편 → 자산 한 줄 — 여기서 끝납니다.</p>
      </div>

      {/* ② 퀵 기록 — 검색→별 원스트로크 (평점 ⟹ 봤어요) */}
      <QuickRate onRate={(h: QuickHit, v: number) => rateNew({ ...h, rating: null }, v)} />

      {/* ③ 오늘의 한 편 — delta는 2 미만 표기 금지(현재 항상 미표기) */}
      {today ? (
        <div className="today" onClick={() => openRec(today)}>
          <span className="tpo" style={today.poster_path ? { backgroundImage: `url(${IMG342}${today.poster_path})` } : {}} />
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: "var(--sub)" }}>오늘의 한 편</div>
            <div className="tt ser">{today.title}</div>
            <div className="tsub">{today.year ?? "?"}{today.director ? ` · ${today.director}` : ""}</div>
            <div className="twhy" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {todayChips.map((c, i) => <span key={i} className={`rsn ${c.cls}`}>{c.label}</span>)}
              {todayFit != null ? <span className="mono" style={{ fontSize: 11.5, color: "var(--sub)" }}>적합도 {Math.round(todayFit)}</span> : null}
              {today.avail?.state === "on" ? <span style={{ fontSize: 11.5, color: "var(--sub)" }}><span className="avdot" /> {today.avail.provider ?? "지금 가능"}</span> : null}
            </div>
            <div className="tact" onClick={(e) => e.stopPropagation()}>
              <span className="actbtn pri" onClick={() => keep(today)}>{kept.has(today.slug) ? "✓ 담김" : "담기"}</span>
              <span className="actbtn" onClick={() => seen(today)}>봤어요</span>
              <span className="actbtn" onClick={() => setCursor((c) => c + 1)}>다른 한 편</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="emptyins">추천을 낼 취향 표본이 부족합니다(★3.5+ 3편부터)</div>
      )}

      {/* ④ 최근 본 */}
      <div>
        <div className="v2h"><h3>최근 본</h3><a className="all" href="/room/collection">컬렉션 전체 →</a></div>
        {strip.length ? (
          <div className="postrip">
            {strip.map((f) => (
              <div className="pcard" key={f.slug} onClick={() => openRecent(f)}>
                <span className="ppo" style={{ display: "block", ...(f.poster_path ? { backgroundImage: `url(${IMG185}${f.poster_path})` } : {}) }} />
                <div className="pst">★{reRated[f.slug] ?? f.rating ?? "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyins">아직 기록이 없습니다 — 위 검색에서 별을 누르면 시작됩니다.</div>
        )}
      </div>

      {/* ⑤ 다음 후보 — 워치리스트 상위와 같은 순서(허브 프리뷰 계약) */}
      {next6.length ? (
        <div>
          <div className="v2h"><h3>다음 후보</h3><a className="all" href="/room/watchlist">전체 보기 →</a></div>
          {next6.map((f) => (
            <FilmRow key={f.slug}
              f={{ slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
                chip: chipsOf(f)[0] ?? null, fit: num(f.wwi) != null ? Math.round(num(f.wwi)!) : null,
                avail: f.avail, risk: num(f.r), kept: kept.has(f.slug) }}
              onOpen={() => openRec(f)} onKeep={() => keep(f)} onSeen={() => seen(f)} onDismiss={() => dismiss(f)} />
          ))}
        </div>
      ) : null}

      {/* ⑥ 완파까지 N편 — seen>0 계보만, 다음 마일스톤 잔여 (coverage 비면 미표시) */}
      {covRows.length ? (
        <div>
          <div className="v2h"><h3>완파까지 {covRows[0].rem}편</h3></div>
          {covRows.map((x) => (
            <div className="covrow2" key={x.c.list_id} onClick={() => openCov(x)}>
              <div className="cn">{x.c.label}<small>{FACET_LABEL[x.c.facet] ?? x.c.facet}</small></div>
              <div className="track"><i style={{ width: `${Math.min(100, x.pct)}%` }} /></div>
              <div className="rem">{x.rem}편 남음 · {x.pct}%</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ⑦ 자산 한 줄 */}
      <div className="vline" onClick={openNav}>
        NAV <b>{navV ?? "—"}</b> <span className="tier">{tier}</span>
        <span>· 관람 <b>{num(data.nav?.n_watched ?? null) ?? 0}</b></span>
        <span>· loved <b>{num(data.stats?.loved ?? null) ?? 0}</b></span>
      </div>

      {/* ⑧ 공용 토스트 */}
      {toast}
    </div>
  );
}
