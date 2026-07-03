"use client";
/** 보유 Collection v2 — 가벼운 보유 목록. 행 = 판단 1개(발굴 칩) + 숫자 2개(정전가·내 별점).
 *  상세 숫자는 전부 공용 인스펙터(RecInsp)로. 50행/페이지, 검색·필터는 전체 rows에 적용 후 페이지 나눔. */
import { useMemo, useState, useEffect } from "react";
import { useInspector } from "./InspectorContext";
import RecInsp, { type RecFilm } from "./RecInsp";
import Stars from "./Stars";
import { useRoomActions } from "./useRoomActions";

export type CollRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; v: number | null; c: number | null; r: number | null; u: number | null;
  prestige: number | null; discovery: number | null; conf: number | null; tier: string | null;
  imdb: number | null; rt: number | null; meta: number | null; votes: number | null;
  added_at: string | null;
  facets: string[] | null;
};

const IMG = "https://image.tmdb.org/t/p/w92";
const PAGE = 50;
// PostgREST numeric은 string으로 올 수 있음 — 반드시 코어스
const num = (x: unknown): number | null => x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);
// 발굴 = 내 별점(×20)이 정전가보다 +12 이상 높음 (실데이터로만 계산 — 지어내지 않음)
const gap = (f: CollRow): number | null => {
  const rt = num(f.rating), p = num(f.prestige);
  return rt != null && p != null ? Math.round(rt * 20 - p) : null;
};
const isFind = (f: CollRow) => (gap(f) ?? -99) >= 12;

const GRID = { display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 90px 120px" } as const;

export default function CollectionWorkspace({ rows }: { rows: CollRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { doRate, toast } = useRoomActions();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "rating" | "prestige">("recent");
  const [findOnly, setFindOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [over, setOver] = useState<Record<string, number>>({}); // 재평가 낙관 반영 (서버 확정값)

  // 재평가 오버라이드 적용본 — 이후 모든 계산은 이걸 쓴다
  const eff = useMemo(
    () => rows.map((r) => (over[r.slug] != null ? { ...r, rating: over[r.slug] } : r)),
    [rows, over]
  );

  const rated = eff.filter((r) => num(r.rating) != null).length;
  const findCount = eff.filter(isFind).length;

  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-library" /> 보유 요약</h4>
          <div className="kv"><span>보유(관람)</span><b>{eff.length}</b></div>
          <div className="kv"><span>평가됨</span><b>{rated}</b></div>
          <div className="kv"><span>발굴</span><b>{findCount}</b></div>
        </div>
        <div className="emptyins">행을 클릭하면 상세 숫자와 재평가가 열립니다.</div>
      </div>
    );
  }, [eff, rated, findCount, setDefault]);

  // 검색·필터·정렬은 전체 rows 대상 → 그 다음 페이지 나눔
  const view = useMemo(() => {
    let a = eff;
    if (q.trim()) { const t = q.toLowerCase(); a = a.filter((r) => r.title.toLowerCase().includes(t) || (r.director ?? "").toLowerCase().includes(t)); }
    if (findOnly) a = a.filter(isFind);
    const s = [...a];
    if (findOnly) s.sort((x, y) => (gap(y) ?? -99) - (gap(x) ?? -99));
    else if (sort === "recent") s.sort((x, y) => (y.added_at ?? "").localeCompare(x.added_at ?? ""));
    else if (sort === "rating") s.sort((x, y) => (num(y.rating) ?? -1) - (num(x.rating) ?? -1));
    else s.sort((x, y) => (num(y.prestige) ?? -1) - (num(x.prestige) ?? -1));
    return s;
  }, [eff, q, sort, findOnly]);

  useEffect(() => { setPage(1); }, [q, sort, findOnly]);

  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = view.slice((cur - 1) * PAGE, cur * PAGE);

  const openRow = (f: CollRow) => {
    const rf: RecFilm = {
      slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
      rating: num(f.rating), v: num(f.v), c: num(f.c), r: num(f.r), u: num(f.u),
      prestige: num(f.prestige), discovery: num(f.discovery), conf: num(f.conf), tier: f.tier,
    };
    insp.select(
      <RecInsp f={rf} onRate={async (x, v) => {
        const row = await doRate(x.slug, x.title, v);
        if (row) setOver((o) => ({ ...o, [x.slug]: row.rating }));
      }} />,
      "보유작 상세"
    );
  };

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">보유 영화</h1>
        <p className="v2sub">{eff.length}편 · 평가 {rated}편</p>
      </div>

      <div>
        <div className="xtoolbar">
          <div className="xsearch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="보유작 검색" /></div>
          <div className="xseg">
            {([["recent", "최근순"], ["rating", "내 별점순"], ["prestige", "정전가순"]] as const).map(([k, l]) => (
              <button key={k} className={sort === k && !findOnly ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
          <div className={`findtoggle${findOnly ? " on" : ""}`} onClick={() => setFindOnly((v) => !v)}><i className="ti ti-diamond" /> 발굴만 <span className="ct">{findCount}</span></div>
        </div>

        {slice.map((f) => {
          const rt = num(f.rating), p = num(f.prestige);
          return (
            <div key={f.slug} className="frow" style={GRID} onClick={() => openRow(f)}>
              <span className="fpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
              <div style={{ minWidth: 0 }}>
                <div className="ft">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
                {isFind(f) ? <div className="fm"><span className="rsn safe">발굴</span></div> : null}
              </div>
              <div className="mono" style={{ fontSize: 15, color: "var(--ink)", textAlign: "right" }}>{p != null ? Math.round(p) : "—"}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                {rt != null ? (
                  <><Stars value={rt} size={13} /><span className="mono" style={{ fontSize: 12, color: "var(--sub)" }}>{rt.toFixed(1)}</span></>
                ) : <span style={{ fontSize: 11.5, color: "var(--mut)" }}>—</span>}
              </div>
            </div>
          );
        })}

        {view.length === 0 ? (
          <div style={{ padding: 24, color: "var(--sub)", fontSize: 13 }}>
            {rows.length === 0
              ? <>보유작이 없습니다. 영화를 &quot;봤어요&quot;로 표시하면 여기에 나타납니다.</>
              : <>조건에 맞는 보유작이 없습니다 — 검색어나 필터를 조정해 보세요.</>}
          </div>
        ) : (
          <div className="pgn">
            <button disabled={cur <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
            <span className="pc">{cur}/{pages}</span>
            <button disabled={cur >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>→</button>
            <span className="pc">{view.length}편 중 {(cur - 1) * PAGE + 1}–{Math.min(cur * PAGE, view.length)}</span>
          </div>
        )}
      </div>

      {toast}
    </div>
  );
}
