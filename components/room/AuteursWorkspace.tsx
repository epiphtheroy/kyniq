"use client";
/** 감독 정복 (Auteur Conquest) — /room/auteurs.
 *  REAL data via me_auteur_conquest(): for every director the user has started (seen ≥1
 *  VISIBLE film of), show OEUVRE COMPLETION (seen / total films in our DB) with the 완파
 *  4-state bar (잠금<50 · 진행50–74 · 근접75–99 · 완파100), avg ★, and surface the unseen
 *  essential films (highest prestige, with TakeScore U=V−R) as 도장깨기(conquer) candidates.
 *
 *  Inspector-swap mirrors CommandCenterWorkspace/CollectionWorkspace: setDefault in a
 *  useEffect with [data,setDefault]-style deps; insp.select on director / film click.
 *  Unseen films pass a slug to CinecodexCard so the film content hub opens.
 *  PostgREST numerics arrive as strings → coerce with num() before any math. */
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

/* ── typed RPC shape (numerics may arrive as strings from PostgREST) ── */
export type UnseenFilm = {
  slug: string; title: string; year: number | null; poster_path: string | null;
  prestige: number | string | null; u: number | string | null;
};
export type AuteurRow = {
  slug: string; name: string | null; profile_path: string | null;
  seen: number | string | null; total: number | string | null; pct: number | string | null;
  avg_rating: number | string | null; unseen_top: UnseenFilm[] | null;
};

const IMG = "https://image.tmdb.org/t/p/w92";
const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

const stars = (rt: number | null) => {
  if (rt == null) return "─────";
  const full = Math.floor(rt); const half = rt - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
};

/* 완파 4-state (S4): 잠금<50 gray · 진행50–74 --canon · 근접75–99 --canon(glow) · 완파100 --conquer */
function covState(pct: number): { cls: string; label: string; col: string } {
  if (pct >= 100) return { cls: "st-done", label: "완파", col: "var(--conquer)" };
  if (pct >= 75) return { cls: "st-near", label: "근접", col: "var(--canon)" };
  if (pct >= 50) return { cls: "st-prog", label: "진행", col: "var(--canon)" };
  return { cls: "st-lock", label: "잠금", col: "var(--sub)" };
}

/* ── derived normalizers ── */
type Unseen = {
  slug: string; title: string; year: number | null; poster_path: string | null;
  prestige: number | null; u: number | null;
};
type Auteur = {
  slug: string; name: string; profile_path: string | null;
  seen: number; total: number; pct: number; avg_rating: number | null; unseen: Unseen[];
};
function normUnseen(f: UnseenFilm): Unseen {
  return {
    slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path,
    prestige: num(f.prestige), u: num(f.u),
  };
}
function normAuteur(r: AuteurRow): Auteur {
  const seen = num(r.seen) ?? 0;
  const total = num(r.total) ?? 0;
  const pct = num(r.pct) ?? (total ? Math.round((seen / total) * 100) : 0);
  return {
    slug: r.slug, name: r.name ?? r.slug, profile_path: r.profile_path,
    seen, total, pct, avg_rating: num(r.avg_rating),
    unseen: (r.unseen_top ?? []).map(normUnseen),
  };
}

/* ── inspector: 도장깨기 후보 하나 (Cinecodex + film hub via slug) ── */
function ConquerInsp({ f, dir }: { f: Unseen; dir?: string }) {
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div>
          <div className="seltitle ser">{f.title}</div>
          <div className="selsub">{f.year ?? "?"}{dir ? ` · ${dir}` : ""} · 도장깨기 후보</div>
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-target-arrow" /> 정복 대상 · 미관람 필수작</h4>
        <div className="bigscore" style={{ color: "var(--canon)" }}>{f.prestige != null ? Math.round(f.prestige) : "—"}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>정전가 · Standing</span></div>
        <div className="kv" style={{ marginTop: 8 }}><span><span className="gloss" title="TakeScore U = V(획득가치) − R(위험). 높을수록 볼 값어치.">TakeScore U</span> (V−R)</span><b style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</b></div>
        <div className="au-rsn-line"><span className="rsn conquer"><i className="ti ti-flag" /> 도장깨기</span></div>
      </div>
      <CinecodexCard d={{ v: null, c: null, r: null, prestige: f.prestige }} slug={f.slug} />
    </div>
  );
}

/* ── inspector: 감독 정복 상세 (oeuvre + 도장깨기 rows) ── */
function AuteurInsp({ a, onFilm }: { a: Auteur; onFilm: (f: Unseen, dir: string) => void }) {
  const st = covState(a.pct);
  const remain = Math.max(0, a.total - a.seen);
  return (
    <div>
      <div className="selhead">
        <span className="po" style={a.profile_path ? { backgroundImage: `url(${IMG}${a.profile_path})` } : {}} />
        <div>
          <div className="seltitle ser">{a.name}</div>
          <div className="selsub">감독 · 정복도 {a.pct}% · {st.label}</div>
        </div>
      </div>

      <div className="icard"><h4><i className="ti ti-crown" /> 오이브르 정복도 · OEUVRE</h4>
        <div className="bigscore" style={{ color: st.col }}>{a.pct}%<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>{a.seen} / {a.total} 관람 · {st.label}</span></div>
        <div className="crow" style={{ marginTop: 8 }}>
          <span className="cl"><span className="gloss" title="정복도 = 우리 DB의 이 감독 전 작품 중 내가 본 비율(%).">정복도</span></span>
          <span className="cbar"><i style={{ width: `${Math.max(a.pct, a.pct > 0 ? 3 : 1)}%`, background: st.col }} /></span>
          <span className="cvv">{a.pct}</span>
        </div>
        <div className="au-ms">
          {[50, 75, 100].map((m) => {
            const on = a.pct >= m;
            const cls = on ? (m === 100 ? "conquer" : "canon") : "";
            return <span key={m} className={`rsn ${cls}`} style={on ? {} : { opacity: 0.4 }}>{m === 100 ? "완파" : `${m}%`}</span>;
          })}
        </div>
        <div className="kv" style={{ marginTop: 8 }}><span>내 평균 ★</span><b>{a.avg_rating != null ? a.avg_rating.toFixed(2) : "—"}</b></div>
        <div style={{ fontSize: 11, color: "var(--canon)", marginTop: 6 }}>
          <i className="ti ti-flag" /> {a.pct >= 100 ? "완파 완료 — 우리 DB 기준 전작" : `완파까지 ${remain}편 남음`}
        </div>
      </div>

      <div className="icard"><h4><i className="ti ti-target-arrow" /> 도장깨기 · 미관람 필수작 {a.unseen.length ? `(${a.unseen.length})` : ""}</h4>
        {a.unseen.length ? (
          <div className="au-conqlist">
            {a.unseen.map((f) => (
              <div key={f.slug} className="au-conqrow" onClick={() => onFilm(f, a.name)}>
                <span className="au-cpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                <div className="au-cbody">
                  <div className="au-ctt">{f.title}</div>
                  <div className="au-csub">{f.year ?? "?"}</div>
                </div>
                <div className="au-cnum"><div className="pv" style={{ color: "var(--canon)" }}>{f.prestige != null ? Math.round(f.prestige) : "—"}</div><div className="pl">정전가</div></div>
                <div className="au-cnum"><div className="pv" style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</div><div className="pl">U</div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyins">미관람 후보가 없습니다 — 이 감독은 이미 완파했거나 남은 작품이 DB에 없습니다.</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ main ═══════════ */
type SortKey = "pct" | "seen" | "name";

export default function AuteursWorkspace({ rows }: { rows: AuteurRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const [sort, setSort] = useState<SortKey>("seen");
  const [sel, setSel] = useState<string | null>(null);

  const auteurs = useMemo(() => rows.map(normAuteur), [rows]);

  /* ── KPI ── */
  const started = auteurs.length;
  const conquered = useMemo(() => auteurs.filter((a) => a.pct >= 100).length, [auteurs]);
  const avgPct = useMemo(() => {
    if (!auteurs.length) return null;
    return Math.round(auteurs.reduce((s, a) => s + a.pct, 0) / auteurs.length);
  }, [auteurs]);
  const conquerCount = useMemo(() => auteurs.reduce((s, a) => s + a.unseen.length, 0), [auteurs]);

  /* ── 도장깨기 데스크: flat cross-director list of top unseen essentials, prestige desc ── */
  const conquerDesk = useMemo(() => {
    const flat: (Unseen & { dir: string })[] = [];
    for (const a of auteurs) for (const f of a.unseen) flat.push({ ...f, dir: a.name });
    return flat.sort((x, y) => (y.prestige ?? -1) - (x.prestige ?? -1)).slice(0, 12);
  }, [auteurs]);

  /* ── sorted director list ── */
  const view = useMemo(() => {
    const s = [...auteurs];
    if (sort === "pct") s.sort((x, y) => y.pct - x.pct || y.seen - x.seen);
    else if (sort === "seen") s.sort((x, y) => y.seen - x.seen || y.pct - x.pct);
    else s.sort((x, y) => x.name.localeCompare(y.name));
    return s;
  }, [auteurs, sort]);

  const openFilm = (f: Unseen, dir: string) => { setSel(f.slug); insp.select(<ConquerInsp f={f} dir={dir} />, `${f.title} · 도장깨기`); };
  const openAuteur = (a: Auteur) => { setSel(a.slug); insp.select(<AuteurInsp a={a} onFilm={openFilm} />, `${a.name} · 정복`); };

  /* ── default inspector = 정복 요약 (mirrors setDefault pattern) ── */
  useEffect(() => {
    const summary: ReactNode = (
      <div>
        <div className="icard"><h4><i className="ti ti-crown" /> 감독 정복 요약</h4>
          <div className="kv"><span>시작한 감독</span><b>{started}</b></div>
          <div className="kv"><span>완파한 감독 (100%)</span><b style={{ color: conquered ? "var(--conquer)" : "var(--ink)" }}>{conquered}</b></div>
          <div className="kv"><span>평균 정복도</span><b>{avgPct != null ? `${avgPct}%` : "—"}</b></div>
          <div className="kv"><span>도장깨기 후보</span><b>{conquerCount}</b></div>
        </div>
        <div className="emptyins">감독 행이나 도장깨기 후보를 클릭하면 여기에 오이브르 정복도 · 미관람 필수작이 열립니다.</div>
      </div>
    );
    setDefault(summary);
  }, [rows, started, conquered, avgPct, conquerCount, setDefault]);

  /* ── honest empty state ── */
  if (!auteurs.length) {
    return (
      <div className="mainpad">
        <h1 className="secttl">감독 정복 · Auteur Conquest</h1>
        <p className="secsub">감독 한 명의 필모그래피를 얼마나 정복했는지 — <span className="gloss" title="정복도 = 우리 DB의 이 감독 전 작품 중 내가 본 비율(%).">정복도</span>(seen / total)와 <span className="gloss" title="아직 안 본 그 감독의 정전급 필수작.">도장깨기</span> 후보.</p>
        <div className="mod"><div className="emptyins" style={{ padding: 40 }}>
          아직 시작한 감독이 없습니다. 영화를 &quot;봤어요&quot;로 표시하면, 그 감독의 필모그래피 정복도가 여기에 나타납니다.
        </div></div>
      </div>
    );
  }

  return (
    <div className="mainpad">
      <h1 className="secttl">감독 정복 · Auteur Conquest</h1>
      <p className="secsub">
        내가 시작한 감독마다 <span className="gloss" title="정복도 = 우리 DB의 이 감독 전 작품 중 내가 본 비율(%).">정복도</span>(seen / total)를 <span className="gloss" title="잠금<50 · 진행50–74 · 근접75–99 · 완파100">완파 4-state</span> 바로 — 아직 안 본 정전급 필수작이 <span className="gloss" title="도장깨기 = 아직 안 본 그 감독의 필수작. 다음 정복 대상.">도장깨기</span> 후보. 모든 숫자는 실측.
      </p>

      {/* ═══ KPI STRIP ═══ */}
      <div className="au-kpis">
        <div className="kpi"><div className="kl">시작한 감독</div><div className="kn">{started}</div><div className="ks">seen ≥ 1편</div></div>
        <div className="kpi"><div className="kl">완파한 감독</div><div className="kn" style={{ color: conquered ? "var(--conquer)" : "var(--ink)" }}>{conquered}</div><div className="ks">정복도 100%</div></div>
        <div className="kpi"><div className="kl">평균 정복도</div><div className="kn">{avgPct != null ? avgPct : "—"}<small>%</small></div><div className="ks">전 감독 평균</div></div>
        <div className="kpi"><div className="kl">도장깨기 후보</div><div className="kn" style={{ color: "var(--canon)" }}>{conquerCount}</div><div className="ks">다음 정복 대상</div></div>
      </div>

      {/* ═══ 감독 정복 리스트 ═══ */}
      <div className="mod">
        <div className="au-modh">
          <h3><i className="ti ti-crown" /> 감독 정복 리스트</h3>
          <div className="xseg">
            {([["pct", "정복도순"], ["seen", "관람수순"], ["name", "이름순"]] as const).map(([k, l]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          {view.map((a) => {
            const st = covState(a.pct);
            return (
              <div key={a.slug} className={`au-row ${st.cls}${sel === a.slug ? " sel" : ""}`} onClick={() => openAuteur(a)} title={`${a.name} — ${a.seen}/${a.total}`}>
                <span className="au-thumb" style={a.profile_path ? { backgroundImage: `url(${IMG}${a.profile_path})` } : {}} />
                <div className="au-name">
                  <div className="au-nm">{a.name}</div>
                  <div className="au-sub">{a.seen}/{a.total} 관람 · {a.unseen.length ? `도장깨기 ${a.unseen.length}` : "완파"}</div>
                </div>
                <div className="au-barwrap">
                  <div className="au-track"><i style={{ width: `${Math.max(a.pct, a.pct > 0 ? 3 : 1)}%`, background: st.col }} /></div>
                  <span className="au-pct" style={{ color: st.col }}>{a.pct}%</span>
                </div>
                <div className="au-stars" title={a.avg_rating != null ? `${a.avg_rating}` : ""}>
                  <div className="st">{stars(a.avg_rating)}</div>
                  <div className="me">{a.avg_rating != null ? a.avg_rating.toFixed(1) : "미평가"}</div>
                </div>
                <span className="au-statetag">{st.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 도장깨기 데스크 ═══ */}
      <div className="mod">
        <div className="au-modh">
          <h3><i className="ti ti-target-arrow" /> 도장깨기 데스크 · 다음 정복 대상</h3>
          <span className="au-meta">사랑하는 감독의 미관람 정전작 · 정전가순</span>
        </div>
        <div>
          {conquerDesk.length ? conquerDesk.map((f, i) => (
            <div key={`${f.slug}-${f.dir}`} className="au-conqdesk-row" onClick={() => openFilm(f, f.dir)}>
              <div className="au-rk">{i + 1}</div>
              <span className="au-cpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
              <div className="au-cbody">
                <div className="au-ctt">{f.title} <small>{f.year ?? ""}</small></div>
                <div className="au-csub">{f.dir}</div>
                <div className="au-rsn-line"><span className="rsn conquer"><i className="ti ti-flag" /> 도장깨기</span></div>
              </div>
              <div className="au-cnum"><div className="pv" style={{ color: "var(--canon)" }}>{f.prestige != null ? Math.round(f.prestige) : "—"}</div><div className="pl">정전가</div></div>
              <div className="au-cnum"><div className="pv" style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</div><div className="pl">U</div></div>
            </div>
          )) : <div className="emptyins">도장깨기 후보가 없습니다 — 시작한 모든 감독을 이미 완파했습니다.</div>}
        </div>
      </div>
    </div>
  );
}
