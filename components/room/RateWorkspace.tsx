"use client";
/** /room/rate — 기록 · 평가 (평가 입력 워크스테이션).
 *  S6: 반별점 0.5–5 · 평점을 주면 자동 '봤어요'(rate_film upsert seen=true).
 *  REAL data: me_rate_stats(hero/KPI) · me_recent_ratings(내 최근 평가) · film_search(검색→평가) ·
 *  me_taste_neighbors(engine ⑥ 이웃 fly-in) · me_taste_signature(형성/확정 취향 앵커).
 *  Inspector-swap mirrors CollectionWorkspace (no render loop). */
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";

export type RateStats = { rated: number; loved: number; seen: number; watchlist: number; session_new: number; forming: boolean; loved_target: number };
export type RecentRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; rating: number; loved: boolean; watched_at: string | null; added_at: string | null; v: number | null; r: number | null; prestige: number | null };
export type SigRow = { kind: string; label: string; films: number };
type SearchHit = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };
type Neighbor = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; v: number | null; r: number | null; prestige: number | null; sim: number };

const IMG = "https://image.tmdb.org/t/p/w92";
const RING_C = 239; // 2πr, r=38 as in mockup

/* half-star value = numeric rating 0.5–5. star index i (1..5). */
function Stars({ value, onPick, size = "stars" }: { value: number; onPick?: (v: number) => void; size?: "stars" | "istars" }) {
  const [hover, setHover] = useState<number | null>(null);
  const v = hover ?? value;
  const star = size === "istars" ? "istar" : "star";
  return (
    <div className={size} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = v >= i;
        const hf = !lit && v >= i - 0.5;
        return (
          <span key={i} className={`${star}${lit ? " lit" : hf ? " hf" : ""}`}>
            <span className="half" onMouseEnter={onPick ? () => setHover(i - 0.5) : undefined}
              onClick={onPick ? (e) => { e.stopPropagation(); onPick(i - 0.5); } : undefined}>★</span>
            <span className="full" onMouseEnter={onPick ? () => setHover(i) : undefined}
              onClick={onPick ? (e) => { e.stopPropagation(); onPick(i); } : undefined}>★</span>
          </span>
        );
      })}
    </div>
  );
}

const fmtStar = (v: number | null) => (v == null || v <= 0 ? "—" : `${v % 1 ? v.toFixed(1) : v.toFixed(0)}★`);
const posterStyle = (p: string | null) => (p ? { backgroundImage: `url(${IMG}${p})` } : {});

export default function RateWorkspace({ stats, recent, sig }: { stats: RateStats; recent: RecentRow[]; sig: SigRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const supabase = useMemo(() => createClient(), []);

  // local overlay of freshly-rated films (so UI reflects rate() without full reload)
  const [rated, setRated] = useState<Map<string, RecentRow>>(new Map());
  const [sess, setSess] = useState(0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [lastRated, setLastRated] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [nbLoading, setNbLoading] = useState(false);
  const [nbGen, setNbGen] = useState(0);
  const nbRef = useRef<HTMLDivElement>(null);

  const anchors = useMemo(() => sig.filter((s) => s.kind === "anchor"), [sig]);
  const lineages = useMemo(() => sig.filter((s) => s.kind === "lineage"), [sig]);

  // merged recent list (fresh rates first, then server list, de-duped by slug)
  const merged = useMemo(() => {
    const out: RecentRow[] = [...rated.values()];
    const seen = new Set(out.map((r) => r.slug));
    for (const r of recent) if (!seen.has(r.slug)) { out.push(r); seen.add(r.slug); }
    return out;
  }, [rated, recent]);

  const totalRated = stats.rated + sess;
  const lovedN = stats.loved + [...rated.values()].filter((r) => r.loved && !recent.some((x) => x.slug === r.slug)).length;
  const forming = lovedN < stats.loved_target;
  const lovedCapped = Math.min(lovedN, stats.loved_target);
  const ringOff = Math.max(0, Math.round(RING_C * (1 - lovedCapped / stats.loved_target)));

  /* ── fetch neighbors for a slug (engine ⑥, real) ── */
  const loadNeighbors = useCallback(async () => {
    setNbLoading(true);
    const { data } = await supabase.rpc("me_taste_neighbors", { p_limit: 4 });
    const list = (data as Neighbor[] | null) ?? [];
    setNeighbors(list);
    setNbGen((g) => g + list.length);
    setNbLoading(false);
    setTimeout(() => nbRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, [supabase]);

  /* ── write a rating (S6: auto seen=true) ── */
  const doRate = useCallback(async (film: SearchHit, value: number) => {
    const { data, error } = await supabase.rpc("rate_film", { p_slug: film.slug, p_rating: value });
    if (error) return;
    const res = ((data as Array<{ slug: string; rating: number; loved: boolean; seen: boolean }> | null) ?? [])[0];
    const rating = res?.rating ?? value;
    const row: RecentRow = {
      slug: film.slug, title: film.title, year: film.year, poster_path: film.poster_path, director: film.director,
      rating, loved: rating >= 4.5, watched_at: new Date().toISOString().slice(0, 10),
      added_at: new Date().toISOString(), v: null, r: null, prestige: null,
    };
    setRated((m) => { const n = new Map(m); if (!recent.some((x) => x.slug === film.slug) && !n.has(film.slug)) setSess((s) => s + 1); n.set(film.slug, { ...(n.get(film.slug) ?? row), ...row }); return n; });
    setLastRated(film.slug);
    // neighbor fly-in on ★4+ (loved-taste recompute is real)
    if (rating >= 4) loadNeighbors();
  }, [supabase, recent, loadNeighbors]);

  /* ── fuzzy search (public film_search RPC) ── */
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 7 });
      if (!alive) return;
      setHits((data as SearchHit[] | null) ?? []);
      setSearching(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, supabase]);

  /* ── inspector: film detail (rate + neighbors + asset) ── */
  const filmInsp = useCallback((f: RecentRow) => (
    <div>
      <div className="selhead">
        <span className="po" style={posterStyle(f.poster_path)} />
        <div><div className="seltitle ser">{f.title}</div>
          <div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div>
          {f.rating ? <div style={{ marginTop: 6 }}><span className="ratebadge"><i className="ti ti-eye" style={{ fontSize: 11 }} /> 봤어요 · {fmtStar(f.rating)}</span></div> : null}
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-star" /> 평가 · 0.5–5 반별점</h4>
        <Stars value={f.rating} size="istars" onPick={(v) => doRate(f, v)} />
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>
          <b style={{ color: "var(--ink)" }}>평점 ⟹ 봤어요</b> · 별을 누르면 자동으로 &lsquo;봤어요&rsquo;로 기록되고 취향 벡터가 갱신됩니다.
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-coin" /> 자산 지표 · Cinecodex</h4>
        <div className="kv"><span>획득가치 V</span><b>{f.v != null ? Math.round(f.v) : "—"}</b></div>
        <div className="kv"><span>위험도 R</span><b>{f.r != null ? Math.round(f.r) : "—"}</b></div>
        <div className="kv"><span>정전가</span><b>{f.prestige != null ? Math.round(f.prestige) : "—"}</b></div>
      </div>
      <a href={`/room/film/${f.slug}`} className="actbtn" style={{ display: "block", textAlign: "center", fontSize: 11.5 }}>전체 평가 카드 · 13 서브점수 →</a>
    </div>
  ), [doRate]);

  const selectFilm = useCallback((f: RecentRow) => { setSel(f.slug); insp.select(filmInsp(f), f.title); }, [insp, filmInsp]);

  /* ── default inspector: 온보딩 진행 + 형성 중 취향 시그니처 (real anchors) ── */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-rocket" /> 온보딩 진행</h4>
          <div className="bigscore"><span className="n" style={{ color: forming ? "var(--forming)" : "var(--safe)", fontSize: 30, fontFamily: "var(--mono)" }}>{lovedCapped}</span>
            <span style={{ fontSize: 10, color: "var(--sub)", letterSpacing: ".1em" }}>/ {stats.loved_target} LOVED · v_loved {forming ? "확정까지" : "확정됨"}</span></div>
          <div className="kv"><span>평가 영화</span><b>{totalRated}</b></div>
          <div className="kv"><span>사랑함 (★4.5+)</span><b>{lovedN}/{stats.loved_target}</b></div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>
            <b style={{ color: "var(--mut)" }}>평점 ⟹ 봤어요</b> · 반별점(0.5–5)을 주면 자동 &lsquo;봤어요&rsquo;. ★4.5+가 {stats.loved_target}편 모이면 취향 벡터가 확정됩니다.
          </div>
        </div>
        <div className="icard"><h4><i className="ti ti-fingerprint" /> {forming ? "형성 중" : "확정된"} 취향 시그니처</h4>
          {anchors.length ? (
            <>
              <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 6 }}>사랑한 작품에서 반복되는 <b style={{ color: "var(--mut)" }}>해석 앵커</b> (figure_type · 실측)</div>
              <div>{anchors.slice(0, 5).map((a) => <span key={a.label} className="anchorchip" title={`${a.films}편에서 반복`}>{a.label}</span>)}</div>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>아직 앵커가 형성되지 않았습니다 — ★4.5+ 작품을 더 평가하면 반복되는 해석 패턴이 나타납니다.</div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>앵커 = loved 누적이 v_loved에 수렴 · 코사인 상위</div>
        </div>
        <div className="icard"><h4><i className="ti ti-affiliate" /> 공통 계보 · 내 loved</h4>
          {lineages.length ? lineages.slice(0, 5).map((l) => (
            <div className="kv" key={l.label}><span style={{ fontFamily: "var(--ser)", fontSize: 12 }}>{l.label}</span><b>{l.films}편</b></div>
          )) : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>계보 데이터 형성 중.</div>}
        </div>
      </div>
    );
  }, [setDefault, anchors, lineages, forming, lovedCapped, lovedN, totalRated, stats.loved_target]);

  const lastFilm = lastRated ? merged.find((r) => r.slug === lastRated) : null;

  return (
    <div className="mainpad">
      <h1 className="secttl">기록 · 평가 · 평가 입력 워크스테이션</h1>
      <p className="secsub">반별점 <b style={{ color: "var(--ink)" }}>0.5–5</b> — <span className="gloss" title="평점을 주면 자동으로 '봤어요'로 기록됩니다">평점 ⟹ 봤어요</span>. ★4 이상이면 해석적으로 닮은 <span className="gloss" title="engine ⑥ · film_taste_vector 코사인 근접">이웃</span>이 fly-in. 평가는 NAV를 깎지 않습니다.</p>

      {/* HERO — 취향 벡터 형성/확정 (real) */}
      <div className="rate-hero">
        <div className="rate-navbig">
          <div className="rate-ring">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
              <circle cx="46" cy="46" r="38" fill="none" stroke={forming ? "var(--forming)" : "var(--safe)"} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={ringOff} transform="rotate(-90 46 46)" />
              <text x="46" y="44" textAnchor="middle" fontSize="20" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{lovedCapped}</text>
              <text x="46" y="58" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1.2">/ {stats.loved_target} LOVED</text>
            </svg>
          </div>
          <div className="rate-navmeta">
            <div className="eb">취향 벡터 · Taste Vector</div>
            <div className="lvl" style={{ color: forming ? "var(--forming)" : "var(--safe)" }}>● {forming ? "형성 중 (FORMING)" : "확정 (LOCKED)"}</div>
            <div className="pctl">★4.5+ <b>{lovedN}</b>편 — {forming ? `${stats.loved_target}편부터 v_loved 확정 · 추천 정밀도↑` : "v_loved 확정 · 추천 정밀도 최대"}</div>
          </div>
        </div>
        <div className="rate-components">
          <div className="rate-comp"><span className="cl">평가한 영화</span><div className="ct"><i style={{ width: `${Math.min(100, totalRated)}%`, background: "var(--frontier)" }} /></div><span className="cv">{totalRated}</span></div>
          <div className="rate-comp"><span className="cl">사랑한 작품 (★4.5+)</span><div className="ct"><i style={{ width: `${Math.min(100, lovedN / stats.loved_target * 100)}%`, background: forming ? "var(--forming)" : "var(--safe)" }} /></div><span className="cv">{lovedN}/{stats.loved_target}</span></div>
          <div className="rate-comp"><span className="cl">이번 세션 신규</span><div className="ct"><i style={{ width: `${Math.min(100, sess * 8)}%`, background: "var(--safe)" }} /></div><span className="cv">+{sess}</span></div>
          <div className="rate-comp"><span className="cl">이웃 추천 생성</span><div className="ct"><i style={{ width: `${Math.min(100, 20 + nbGen * 8)}%`, background: "var(--reading)" }} /></div><span className="cv">{nbGen}</span></div>
        </div>
        <div className="rate-explain"><i className="ti ti-info-circle" /> <b style={{ color: "var(--mut)" }}>평점 ⟹ 봤어요</b> — 별점(0.5–5 반별점)을 주면 자동으로 &lsquo;봤어요&rsquo;로 기록되고, 매 평가가 취향 벡터를 갱신합니다. 평가는 NAV를 깎지 않습니다.</div>
      </div>

      {/* KPI STRIP (real) */}
      <div className="rate-kpis">
        <div className="rate-kpi"><div className="eb">누적 평가</div><div className="v">{totalRated}</div><div className="d up">▲ {sess} · 세션</div></div>
        <div className="rate-kpi"><div className="eb">이번 세션</div><div className="v">+{sess}</div><div className="d flat">평점⟹봤어요</div></div>
        <div className="rate-kpi"><div className="eb">사랑함 ★4.5+</div><div className="v">{lovedN}<small>/{stats.loved_target}</small></div><div className="d up">형성 게이지</div></div>
        <div className="rate-kpi"><div className="eb">볼 영화 후보</div><div className="v">{stats.watchlist}</div><div className="d flat">watchlist</div></div>
        <div className="rate-kpi"><div className="eb">취향 벡터</div><div className="v" style={{ fontSize: 17, color: forming ? "var(--forming)" : "var(--safe)" }}>{forming ? "형성중" : "확정"}</div><div className="d flat">{stats.loved_target}편 기준</div></div>
      </div>

      {/* SEARCH → 평가 */}
      <div className="rate-searchbox">
        <i className="ti ti-search si" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목을 입력해 빠르게 평가 (검색 후 별을 누르면 자동 '봤어요')" />
        <span className="hint">film_search</span>
        {q.trim() ? (
          <div className="rate-sugg">
            {searching ? <div className="sg busy">검색 중…</div>
              : hits.length ? hits.map((f) => (
                <div className="sg" key={f.slug}>
                  <span className="po fpo" style={{ width: 32, height: 46, ...posterStyle(f.poster_path) }} />
                  <div style={{ minWidth: 0 }}><div className="t">{f.title}</div><div style={{ fontSize: 10, color: "var(--sub)" }}>{f.director ?? ""}{f.year ? ` · ${f.year}` : ""}</div></div>
                  <div className="m"><Stars value={merged.find((r) => r.slug === f.slug)?.rating ?? 0} onPick={(v) => { doRate(f, v); setQ(""); }} /><div style={{ fontSize: 9, color: "var(--faint)", marginTop: 2 }}>별 누르면 ★평가</div></div>
                </div>
              )) : <div className="sg busy">결과 없음</div>}
          </div>
        ) : null}
      </div>

      {/* RATE WORKSTATION — 내 최근 평가 (real) */}
      <div className="rate-mod primary">
        <div className="rate-modh"><h3><i className="ti ti-star" /> 여기서 평가 · <span className="ser" style={{ fontWeight: 400 }}>내 최근 평가</span></h3>
          <span className="meta">{merged.length}편 기록 · 0.5–5★</span></div>
        <div className="rate-modbody">
          <div className="ratecue"><i className="ti ti-click" /> <span>본 영화의 <b>별을 누르세요</b> — 0.5–5★ 반별점. 누르는 순간 <b>자동 &lsquo;봤어요&rsquo;</b>로 기록되고, ★4 이상이면 닮은 영화가 아래로 날아옵니다.</span></div>
          <div className="relchips">
            {lastFilm ? (
              <>
                <span className="lbl">방금 평가 → <b>{lastFilm.title}</b> {fmtStar(lastFilm.rating)}</span>
                {anchors.slice(0, 3).map((a) => <span key={a.label} className="anchorchip">{a.label}</span>)}
              </>
            ) : (
              <span className="lbl">위 <b>검색창</b>에서 영화를 찾아 별을 눌러 시작 · 아래는 이미 평가한 작품 — 별을 다시 눌러 재평가할 수 있습니다.</span>
            )}
          </div>
          <div className="cgrid">
            {merged.length ? merged.map((f) => (
              <div key={f.slug} className={`fcard${sel === f.slug ? " sel" : ""}`} onClick={() => selectFilm(f)}>
                <span className="fpo" style={posterStyle(f.poster_path)}>{f.year ? <span className="f">{f.year}</span> : null}</span>
                <div className="fc-b">
                  <div className="fc-t">{f.title}{f.loved ? <span className="rated-badge">LOVED</span> : null}</div>
                  <div className="fc-d">{f.director ?? ""}</div>
                  <div className="starwrap"><Stars value={f.rating} onPick={(v) => doRate(f, v)} /><span className="scalehint">{fmtStar(f.rating)} · 평점⟹봤어요</span></div>
                </div>
              </div>
            )) : (
              <div className="emptyset"><i className="ti ti-star" style={{ color: "var(--gold)" }} /> 아직 평가한 영화가 없습니다 — 위 <b>검색창</b>에서 본 영화를 찾아 별을 누르면 여기에 기록됩니다.</div>
            )}
          </div>
        </div>
      </div>

      {/* NEIGHBOR FLY-IN (이웃) — engine ⑥, real me_taste_neighbors */}
      <div className={`nbpanel${neighbors.length ? " armed" : ""}`} ref={nbRef}>
        <div className="nbhd"><h3><i className="ti ti-affiliate" /> 이웃 · 어떻게 알았지</h3>
          {neighbors.length ? <span className="nbcount"><i className="ti ti-sparkles" style={{ fontSize: 11 }} /> {neighbors.length}편 도착</span> : null}
          <span className="meta">engine ⑥ · film_taste_vector · 해석적 이웃</span></div>
        <div className="nbbody">
          {nbLoading ? <div className="nbhint">이웃 탐색 중… <b>loved 취향 코사인</b>으로 근접 작품을 찾습니다.</div>
            : neighbors.length ? (
              <>
                <div className="nbhint">내 <b>loved 취향 벡터</b>에 가장 가까운 미관람작 <span style={{ color: "var(--reading)" }}>— 장르가 아니라 해석적 친연</span></div>
                {neighbors.map((n) => (
                  <div className="nbcard" key={n.slug}>
                    <span className="npo" style={posterStyle(n.poster_path)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="nc-t">{n.title}</div>
                      <div className="nc-d">{n.director ?? ""}{n.year ? ` · ${n.year}` : ""}</div>
                      <div className="nc-aff">왜 떴나 → 취향 근접 <span>(sim {n.sim.toFixed(2)})</span></div>
                    </div>
                    <a href={`/room/film/${n.slug}`} className="nadd" title="평가 → 봤어요"><i className="ti ti-eye-plus" /></a>
                  </div>
                ))}
              </>
            ) : (
              <div className="nbidle"><i className="ti ti-arrow-up-right" style={{ fontSize: 11 }} /> 위에서 영화를 <b>★4 이상</b>으로 평가하면 — 장르가 아니라 <b>해석적으로 닮은</b> 영화가 여기로 날아 들어옵니다.{forming ? " (★4.5+ 3편 이상 모이면 취향 벡터가 이웃을 계산합니다.)" : ""}</div>
            )}
        </div>
      </div>
    </div>
  );
}
