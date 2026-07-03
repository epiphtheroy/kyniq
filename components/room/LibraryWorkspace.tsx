"use client";
/** 서재 Library — 담아둔 모든 것의 아카이브. 영화·감독·트로프·미스리딩·리니지·형상을 한 곳에.
 *  REAL data via me_library() (user_pins normalized, per-pin visibility 포함).
 *  공개/비공개 pill(S9) → set_pin_visibility · ★ 즐겨찾기 → me_toggle_fav — 둘 다 실 mutation
 *  (auth.uid 스코프 DEFINER, 낙관적 UI + 토스트). director·lineage 칩은 저장이 아직 없어 정직 empty. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";

export type LibRow = {
  entity_type: string;      // film | misreading | trope | figure  (director/lineage possible in future)
  slug: string | null;
  film_slug: string | null;
  title: string | null;
  sub: string | null;
  def: string | null;
  film_count: number | null;
  maturity: string | null;
  prestige: number | null;
  rating: number | null;
  seen: boolean | null;
  fav: boolean;
  visibility: string | null;
  created_at: string;
};

type TypeKey = "film" | "director" | "trope" | "misreading" | "lineage" | "figure";
const TYPES: Record<TypeKey, { l: string; c: string; i: string }> = {
  film: { l: "영화", c: "var(--film)", i: "ti-movie" },
  director: { l: "감독", c: "var(--director)", i: "ti-user-star" },
  trope: { l: "트로프", c: "var(--trope)", i: "ti-affiliate" },
  misreading: { l: "미스리딩", c: "var(--misreading)", i: "ti-quote" },
  lineage: { l: "리니지", c: "var(--lineage)", i: "ti-route" },
  figure: { l: "형상", c: "var(--figure)", i: "ti-eye" },
};
const ORDER: TypeKey[] = ["film", "director", "trope", "misreading", "lineage", "figure"];
const IMG = "https://image.tmdb.org/t/p/w92";
const isType = (t: string): t is TypeKey => t in TYPES;

// overlay state (S9) — 서버값(fav·visibility)으로 시딩, 토글 시 mutation RPC로 즉시 저장
type Ov = { fav: boolean; pub: boolean };

function DetailInsp({
  it, ov, onTogglePub, onToggleFav, onBack,
}: { it: LibRow; ov: Ov; onTogglePub: () => void; onToggleFav: () => void; onBack: () => void }) {
  const tk = isType(it.entity_type) ? (it.entity_type as TypeKey) : "misreading";
  const col = TYPES[tk].c;
  return (
    <div>
      <div className="backlink" onClick={onBack}><i className="ti ti-arrow-left" /> 서재 요약으로</div>

      {tk === "film" ? (
        <div className="selhead">
          <span className="po" style={{}} />
          <div>
            <div className="seltitle ser">{it.title}</div>
            <div className="selsub">{it.sub}</div>
            <div className="lib-selflag">
              <span className="lib-insptag" style={{ color: col }}>영화</span>
              {it.seen
                ? <span className="lib-insptag" style={{ color: "var(--safe)", borderColor: "#1d5145" }}>관람</span>
                : <span className="lib-insptag" style={{ color: "var(--gap)", borderColor: "#5e4d1d" }}>볼 영화</span>}
            </div>
          </div>
        </div>
      ) : tk === "misreading" ? (
        <>
          <div style={{ marginBottom: 11 }}><span className="lib-insptag" style={{ color: col }}>미스리딩 · reading</span></div>
          <div className="icard" style={{ borderColor: "#5b481f", background: "#1a1408" }}>
            <div className="lib-insp-quote">“{it.sub || it.title}”</div>
            {it.title ? <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>— 「{it.title}」</div> : null}
          </div>
        </>
      ) : (
        <div className="selhead">
          <span className="lib-selava">{(it.title ?? "?").slice(0, 1)}</span>
          <div>
            <div className="seltitle ser">{it.title}</div>
            <div className="selsub">{TYPES[tk].l}{it.sub ? ` · ${it.sub}` : ""}</div>
            <div className="lib-selflag"><span className="lib-insptag" style={{ color: col }}>{TYPES[tk].l}</span></div>
          </div>
        </div>
      )}

      {tk === "film" ? (
        <div className="icard"><h4><i className="ti ti-coin" /> 자산 지표</h4>
          <div className="kv"><span>정전가 (Standing)</span><b>{it.prestige != null ? Math.round(it.prestige) : "미산정"}</b></div>
          <div className="kv"><span>내 별점</span><b>{it.rating != null ? it.rating.toFixed(1) : (it.seen ? "★ 기록됨" : "미기록")}</b></div>
          <div className="kv"><span>seen / watchlist</span><b style={{ color: it.seen ? "var(--safe)" : "var(--gap)" }}>{it.seen ? "관람 (배타)" : "볼 영화"}</b></div>
        </div>
      ) : null}

      {(tk === "trope" || tk === "figure" || tk === "misreading") && it.def ? (
        <div className="icard"><h4><i className="ti ti-text-caption" /> {tk === "misreading" ? "요지" : "정의"}</h4>
          <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>{it.def}</div>
        </div>
      ) : null}

      {(tk === "trope" || tk === "figure") ? (
        <div className="icard"><h4><i className="ti ti-movie" /> 연결된 영화{it.film_count != null ? ` (${it.film_count})` : ""}</h4>
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
            {it.film_count != null ? `내 서재의 개념이 ${it.film_count}편을 가로지릅니다.` : "연결 영화 수 형성 중."}
            {tk === "trope" && it.maturity ? ` · 성숙도 ${it.maturity}` : ""}
          </div>
        </div>
      ) : null}

      <div className="icard"><h4><i className="ti ti-adjustments" /> 서재 메타</h4>
        <div className="lib-pubtog">
          <span className={`lib-sw${ov.pub ? " on" : ""}`} role="switch" aria-checked={ov.pub} tabIndex={0} onClick={onTogglePub}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePub(); } }} />
          <span>{ov.pub ? <><i className="ti ti-world" style={{ color: "var(--safe)" }} /> 공개 — 프로필 노출</> : <><i className="ti ti-lock" /> 비공개</>}</span>
        </div>
        <div className="actbar" style={{ marginTop: 11 }}>
          <span className={`actbtn${ov.fav ? " pri" : ""}`} onClick={onToggleFav}><i className="ti ti-star" /> {ov.fav ? "즐겨찾기됨" : "즐겨찾기"}</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--sub)", marginTop: 9, lineHeight: 1.5 }}>
          <i className="ti ti-info-circle" /> 공개/비공개·즐겨찾기는 즉시 저장됩니다. 공개 항목의 프로필 노출 표면은 다음 단계에서 붙습니다.
        </div>
      </div>
    </div>
  );
}

export default function LibraryWorkspace({ rows }: { rows: LibRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;

  const supabase = useMemo(() => createClient(), []);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // overlays keyed by entity_type|slug — fav·pub 둘 다 서버값으로 시딩 (me_library)
  const keyOf = (r: LibRow) => `${r.entity_type}|${r.slug ?? r.title ?? ""}`;
  const [ovs, setOvs] = useState<Record<string, Ov>>(() => {
    const o: Record<string, Ov> = {};
    for (const r of rows) o[keyOf(r)] = { fav: r.fav, pub: r.visibility === "public" };
    return o;
  });
  const ov = (r: LibRow): Ov => ovs[keyOf(r)] ?? { fav: r.fav, pub: r.visibility === "public" };

  // 공개토글 → set_pin_visibility (낙관적 UI, 실패 시 토스트)
  const setPub = (r: LibRow) => {
    const next = !ov(r).pub;
    setOvs((p) => { const k = keyOf(r); const cur = p[k] ?? { fav: r.fav, pub: r.visibility === "public" }; return { ...p, [k]: { ...cur, pub: next } }; });
    if (!r.slug) { say("이 항목은 식별자가 없어 세션에서만 표시됩니다"); return; }
    supabase.rpc("set_pin_visibility", { p_entity_type: r.entity_type, p_slug: r.slug, p_public: next })
      .then(({ error }) => say(error ? `저장 실패 — ${error.message}` : next ? `「${r.title}」 공개로 저장됨` : `「${r.title}」 비공개로 저장됨`));
  };

  // 즐겨찾기 → me_toggle_fav (kind='like' 핀 생성/삭제)
  const setFav = (r: LibRow) => {
    const next = !ov(r).fav;
    setOvs((p) => { const k = keyOf(r); const cur = p[k] ?? { fav: r.fav, pub: r.visibility === "public" }; return { ...p, [k]: { ...cur, fav: next } }; });
    if (!r.slug) { say("이 항목은 식별자가 없어 세션에서만 표시됩니다"); return; }
    supabase.rpc("me_toggle_fav", { p_entity_type: r.entity_type, p_slug: r.slug })
      .then(({ error }) => say(error ? `저장 실패 — ${error.message}` : next ? `★ 즐겨찾기 저장됨` : `즐겨찾기 해제됨`));
  };

  const [tfilter, setTfilter] = useState<Set<TypeKey>>(new Set());
  const [pubFilter, setPubFilter] = useState<"all" | "public" | "private">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const cnt = (t: TypeKey) => rows.filter((r) => r.entity_type === t).length;
  const total = rows.length;
  const favN = rows.filter((r) => ov(r).fav).length;
  const pubN = rows.filter((r) => ov(r).pub).length;
  const nonFilm = rows.filter((r) => r.entity_type !== "film").length;

  const view = useMemo(() => rows.filter((r) => {
    if (tfilter.size && (!isType(r.entity_type) || !tfilter.has(r.entity_type as TypeKey))) return false;
    if (pubFilter === "public" && !ov(r).pub) return false;
    if (pubFilter === "private" && ov(r).pub) return false;
    if (q) {
      const hay = `${r.title ?? ""}${r.sub ?? ""}${r.def ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, tfilter, pubFilter, q, ovs]);

  const hasFilters = tfilter.size > 0 || pubFilter !== "all" || q.trim() !== "";
  const clearFilters = () => { setTfilter(new Set()); setPubFilter("all"); setQ(""); };
  const toggleType = (t: TypeKey) => setTfilter((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });

  // page default inspector: 서재 구성 요약
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-stack-2" /> 서재 구성 · 유형별</h4>
          {ORDER.map((t) => (
            <div className="kv" key={t}><span><span style={{ color: TYPES[t].c }}>●</span> {TYPES[t].l}</span><b>{cnt(t)}</b></div>
          ))}
        </div>
        <div className="icard"><h4><i className="ti ti-clock" /> 최근 저장</h4>
          {rows.slice(0, 4).map((r) => (
            <div className="kv" key={keyOf(r)}><span style={{ color: "var(--ink)" }}>{r.title ?? "—"}</span>
              <span style={{ fontSize: 10, color: "var(--sub)" }}>{new Date(r.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</span></div>
          ))}
          {rows.length === 0 ? <div style={{ fontSize: 11, color: "var(--sub)" }}>아직 저장한 항목이 없습니다.</div> : null}
        </div>
        <div className="icard"><h4><i className="ti ti-bulb" /> 서재의 원칙</h4>
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.6 }}>영화만 모으는 곳이 아니다. <b style={{ color: "var(--ink)" }}>감독·트로프·미스리딩·리니지·형상</b> — 영화적 사유의 모든 단위가 같은 방식으로 저장되고, 컬렉션으로 분류되며, 공개/비공개를 가른다.</div>
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, setDefault]);

  const openDetail = (r: LibRow) => {
    setSel(keyOf(r));
    insp.select(
      <DetailInsp it={r} ov={ov(r)} onTogglePub={() => setPub(r)} onToggleFav={() => setFav(r)} onBack={() => { setSel(null); insp.reset(); }} />,
      r.title ?? "항목"
    );
  };

  const pubList = rows.filter((r) => ov(r).pub).slice(0, 6);

  return (
    <div className="mainpad lib-wrap">
      {/* HERO */}
      <div className="lib-hero">
        <div className="lib-navbig">
          <div className="lib-ring">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
              <circle cx="46" cy="46" r="38" fill="none" stroke="var(--lineage)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray="239" strokeDashoffset={total ? 0 : 239} transform="rotate(-90 46 46)" />
              <text x="46" y="44" textAnchor="middle" fontSize="22" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{total}</text>
              <text x="46" y="58" textAnchor="middle" fontSize="8.5" fill="#6C6960" letterSpacing="1.5">SAVED</text>
            </svg>
          </div>
          <div className="lib-navmeta">
            <div className="eb">서재 · 이질적 아카이브</div>
            <div className="lvl">● 영화만이 아니다</div>
            <div className="pctl">영화 · 감독 · 트로프 · 미스리딩 · 리니지 · 형상을 한 곳에</div>
          </div>
        </div>
        <div className="lib-components">
          {ORDER.map((t) => {
            const n = cnt(t); const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <button key={t} className="lib-comp" onClick={() => { setTfilter(new Set([t])); }} title={`${TYPES[t].l}만 보기`}>
                <span className="cl"><span style={{ color: TYPES[t].c }}>●</span> {TYPES[t].l}</span>
                <span className="ct"><i style={{ width: `${pct}%`, background: TYPES[t].c }} /></span>
                <span className="cv">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="lib-explain"><i className="ti ti-info-circle" /><span>서재는 단일 유형이 아니다 — <b>감독·트로프·미스리딩·리니지·형상</b>이 영화와 같은 방식으로 저장·분류·공개된다. 각 항목엔 <b>공개/비공개</b> 토글과 즐겨찾기가 붙는다.</span></div>
      </div>

      {/* KPI STRIP */}
      <div className="lib-kpis">
        <div className="lib-kpi"><div className="eb">총 항목</div><div className="v">{total}</div><div className="d flat">아카이브</div></div>
        <div className="lib-kpi"><div className="eb">즐겨찾기</div><div className="v">{favN}</div><div className="d flat">★ 핀</div></div>
        <div className="lib-kpi"><div className="eb">공개 항목</div><div className="v">{pubN}<small>/{total}</small></div><div className="d up">프로필 노출</div></div>
        <div className="lib-kpi"><div className="eb">유형</div><div className="v">{ORDER.filter((t) => cnt(t) > 0).length}<small>/6</small></div><div className="d flat">active</div></div>
        <div className="lib-kpi"><div className="eb">비영화 항목</div><div className="v">{nonFilm}</div><div className="d up">개념·형상</div></div>
      </div>

      {/* LIBRARY · SAVED ITEMS */}
      <div className="mod">
        <div className="lib-modh" style={{ paddingBottom: 10 }}>
          <h3><i className="ti ti-stack-2" /> {tfilter.size === 1 ? TYPES[[...tfilter][0]].l : "전체"}</h3>
          <span className="meta">{view.length} / {total}개</span>
        </div>
        <div className="lib-toolbar">
          <span className="eb" style={{ alignSelf: "center" }}>유형</span>
          <div className="lib-tchips">
            {ORDER.map((t) => (
              <span key={t} className={`lib-tc${tfilter.has(t) ? " on" : ""}`} onClick={() => toggleType(t)}>
                <i className={`ti ${TYPES[t].i}`} style={{ fontSize: 12, color: tfilter.has(t) ? "inherit" : TYPES[t].c }} />{TYPES[t].l}
              </span>
            ))}
          </div>
          {hasFilters ? <span className="lib-clear" onClick={clearFilters}><i className="ti ti-x" style={{ fontSize: 11 }} />지우기</span> : null}
          <div className="lib-pubfilt">
            {(["all", "public", "private"] as const).map((p) => (
              <button key={p} className={pubFilter === p ? "on" : ""} onClick={() => setPubFilter(p)}>
                {p !== "all" ? <span className="dt" style={{ background: p === "public" ? "var(--safe)" : "var(--sub)" }} /> : null}
                {p === "all" ? "전체" : p === "public" ? "공개" : "비공개"}
              </button>
            ))}
          </div>
          <span className="lib-srch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="서재에서 검색" /></span>
        </div>
        <div className="modbody">
          <div className="lib-grid">
            {view.length ? view.map((r) => {
              const tk = isType(r.entity_type) ? (r.entity_type as TypeKey) : "misreading";
              const col = TYPES[tk].c;
              const o = ov(r);
              return (
                <div key={keyOf(r)} className={`lib-card${sel === keyOf(r) ? " sel" : ""}`} style={{ borderLeftColor: col }} onClick={() => openDetail(r)}>
                  <div className="ttag" style={{ color: col }}>
                    <i className={`ti ${TYPES[tk].i} tyi`} />{TYPES[tk].l}
                    <span className={`lib-pubpill${o.pub ? " pub" : ""}`} role="switch" aria-checked={o.pub} tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setPub(r); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setPub(r); } }}
                      title="공개 프로필 노출 토글">
                      <i className={`ti ${o.pub ? "ti-world" : "ti-lock"}`} />{o.pub ? "공개 중" : "비공개"}
                    </span>
                  </div>
                  <i className={`ti ti-star lib-fav${o.fav ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); setFav(r); }} title="즐겨찾기" />

                  {tk === "film" ? (
                    <div className="lib-filmline">
                      <div className="lib-po" />
                      <div>
                        <div className="lib-ftitle">{r.title}</div>
                        <div className="lib-fsub">{r.sub}</div>
                        <div style={{ marginTop: 8 }}>
                          <span className="lib-chip2">정전가 {r.prestige != null ? Math.round(r.prestige) : "—"}</span>
                          {r.seen
                            ? <span className="lib-chip2" style={{ color: "var(--safe)", borderColor: "#1d5145", marginLeft: 4 }}>관람</span>
                            : <span className="lib-chip2" style={{ color: "var(--gap)", borderColor: "#5e4d1d", marginLeft: 4 }}>볼 영화</span>}
                        </div>
                      </div>
                    </div>
                  ) : tk === "misreading" ? (
                    <>
                      <div className="lib-quote">“{r.sub || r.title}”</div>
                      <div className="lib-qmeta">— 「{r.title}」</div>
                      {r.def ? <div className="lib-deftease">{r.def}</div> : null}
                    </>
                  ) : (tk === "director") ? (
                    <div className="lib-filmline">
                      <div className="lib-avad">{(r.title ?? "?").slice(0, 1)}</div>
                      <div><div className="lib-ftitle">{r.title}</div><div className="lib-fsub">{r.sub}</div></div>
                    </div>
                  ) : (tk === "lineage") ? (
                    <>
                      <div className="lib-ftitle">{r.title}</div>
                      <div className="lib-fsub">{r.sub}</div>
                      {r.def ? <div className="lib-deftease">{r.def}</div> : null}
                    </>
                  ) : (
                    // trope / figure
                    <>
                      <div className="lib-ftitle">「{r.title}」</div>
                      <div className="lib-fsub">
                        {r.film_count != null ? `내 개념 ${r.film_count}편 가로지름` : "형상"}
                        {tk === "trope" && r.maturity ? ` · 성숙도 ${r.maturity}` : ""}
                      </div>
                      {r.def ? <div className="lib-deftease">{r.def}</div> : (r.sub ? <div className="lib-deftease">{r.sub}</div> : null)}
                    </>
                  )}
                  <span className="lib-cardopen"><i className="ti ti-arrow-right" style={{ fontSize: 11 }} />상세 열기</span>
                </div>
              );
            }) : (
              <div className="lib-empty">
                {hasFilters ? (
                  <>
                    <i className="ti ti-filter-off eico" />
                    <div className="et">이 조건에 맞는 항목이 없습니다</div>
                    <div className="es">유형·공개 필터 또는 검색어를 조정해 보세요.{tfilter.has("director") || tfilter.has("lineage") ? " (감독·리니지 저장은 아직 형성 중입니다.)" : ""}</div>
                    <span className="eclr" onClick={clearFilters}><i className="ti ti-x" style={{ fontSize: 11 }} /> 필터 모두 지우기</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-books eico" />
                    <div className="et">서재가 비어 있습니다</div>
                    <div className="es">영화·감독·트로프·미스리딩·리니지·형상 — 무엇이든 찾아 담아 보세요.</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 공개 공유 항목 — mirrors mockup activity card, rendered inline for real data */}
      <div className="mod">
        <div className="lib-modh"><h3><i className="ti ti-world" /> 공개 공유 항목</h3><span className="meta">{pubList.length} 공개</span></div>
        <div className="modbody">
          {pubList.length ? pubList.map((r) => {
            const tk = isType(r.entity_type) ? (r.entity_type as TypeKey) : "misreading";
            return (
              <div className="lib-pubitem" key={keyOf(r)}>
                <span className="d" style={{ background: TYPES[tk].c }} />
                <span className="nm" title={r.title ?? ""}>{r.title}</span>
                <i className="ti ti-world ico" title="공개" />
              </div>
            );
          }) : <div style={{ fontSize: 11.5, color: "var(--sub)", padding: "6px 2px" }}>공개로 전환한 항목이 아직 없습니다 — 항목의 <i className="ti ti-lock" /> 배지를 눌러 공개하세요.</div>}
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
