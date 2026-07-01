"use client";
/** 보유 Collection — 내 영화 자산 거래소. 정전가(시장가) + Cinecodex(V/U) 나란히 + 2축 가치뱃지. */
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

export type CollRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; v: number | null; c: number | null; r: number | null; u: number | null;
  prestige: number | null; discovery: number | null; conf: number | null; tier: string | null;
  imdb: number | null; rt: number | null; meta: number | null; votes: number | null;
};

const IMG = "https://image.tmdb.org/t/p/w92";
const pct = (rt: number | null) => (rt == null ? null : Math.round(rt * 20));
const gapM = (f: CollRow) => (f.rating != null && f.prestige != null ? Math.round(pct(f.rating)! - f.prestige) : null);
const gapA = (f: CollRow) => (f.rating != null && f.v != null ? Math.round(pct(f.rating)! - f.v) : null);
const stars = (rt: number | null) => {
  if (rt == null) return "─────";
  const full = Math.floor(rt); const half = rt - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
};

function Insp({ f }: { f: CollRow }) {
  const rp = f.rating != null ? pct(f.rating) : null;
  const m = gapM(f), a = gapA(f);
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div><div className="seltitle ser">{f.title}</div><div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div></div>
      </div>
      <div className="icard"><h4><i className="ti ti-building-bank" /> 정전가 · 시장가</h4>
        <div className="bigscore">{f.prestige != null ? Math.round(f.prestige) : "—"}</div>
        <div className="kv"><span>Discovery(숨은가치)</span><b>{f.discovery != null ? Math.round(f.discovery) : "—"}</b></div>
        <div className="kv"><span>내 별점</span><b>{f.rating != null ? f.rating.toFixed(1) : "—"}</b></div>
      </div>
      <CinecodexCard d={{ v: f.v, c: f.c, r: f.r, u: f.u, prestige: f.prestige, conf: f.conf, tier: f.tier, imdb: f.imdb, rt: f.rt, meta: f.meta, votes: f.votes, ratingPct: rp }} showBadge />
      {(m != null || a != null) ? (
        <div className="icard"><h4><i className="ti ti-arrows-diff" /> 가치뱃지 2축</h4>
          <div className="kv"><span>시장 합치 (별점−정전가)</span><b style={{ color: m != null && m >= 12 ? "var(--safe)" : m != null && m <= -9 ? "var(--reading)" : "var(--ink)" }}>{m != null ? (m > 0 ? "+" : "") + m : "—"}</b></div>
          <div className="kv"><span>분석 합치 (별점−V)</span><b style={{ color: a != null && a >= 12 ? "var(--safe)" : a != null && a <= -9 ? "var(--reading)" : "var(--ink)" }}>{a != null ? (a > 0 ? "+" : "") + a : "—"}</b></div>
        </div>
      ) : null}
    </div>
  );
}

export default function CollectionWorkspace({ rows }: { rows: CollRow[] }) {
  const insp = useInspector();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"score" | "rating" | "gap" | "recent">("score");
  const [findOnly, setFindOnly] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const scored = rows.filter((r) => r.v != null);
    const medV = scored.length ? [...scored].map((r) => r.v!).sort((a, b) => a - b)[Math.floor(scored.length / 2)] : null;
    insp.setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-chart-pie" /> 포트폴리오 분포</h4>
          <div className="kv"><span>보유(관람)</span><b>{rows.length}</b></div>
          <div className="kv"><span>Cinecodex 평가됨</span><b>{scored.length}</b></div>
          <div className="kv"><span>중앙 V(획득가치)</span><b>{medV ?? "—"}</b></div>
        </div>
        <div className="emptyins">행을 클릭하면 정전가 분해 · Cinecodex · 2축 뱃지가 열립니다.</div>
      </div>
    );
  }, [rows, insp]);

  const view = useMemo(() => {
    let a = rows;
    if (q.trim()) { const t = q.toLowerCase(); a = a.filter((r) => r.title.toLowerCase().includes(t) || (r.director ?? "").toLowerCase().includes(t)); }
    if (findOnly) a = a.filter((r) => (gapM(r) ?? -99) >= 12);
    const s = [...a];
    if (sort === "score") s.sort((x, y) => (y.prestige ?? -1) - (x.prestige ?? -1));
    else if (sort === "rating") s.sort((x, y) => (y.rating ?? -1) - (x.rating ?? -1));
    else if (sort === "gap") s.sort((x, y) => (gapM(y) ?? -99) - (gapM(x) ?? -99));
    return s;
  }, [rows, q, sort, findOnly]);

  const findCount = rows.filter((r) => (gapM(r) ?? -99) >= 12).length;

  return (
    <div className="mainpad">
      <h1 className="secttl">보유 영화 · 자산 거래소</h1>
      <p className="secsub">각 보유작은 <span className="gloss" title="영화가 나와 무관하게 받은 인정 = 객관 시장가">정전가</span>(시장가)를 갖고, 내 평가와의 차익이 <span className="gloss" title="별점과 정전가/V의 차이">가치뱃지</span>. Cinecodex(V·U)는 옆에 나란히 — 절대 안 섞음.</p>

      <div className="xtoolbar">
        <div className="xsearch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="보유작 검색" /></div>
        <div className="xseg">
          {([["score", "정전가순"], ["rating", "내 별점순"], ["gap", "발굴순"]] as const).map(([k, l]) => (
            <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
        <div className={`findtoggle${findOnly ? " on" : ""}`} onClick={() => setFindOnly((v) => !v)}><i className="ti ti-diamond" /> 발굴만 <span className="ct">{findCount}</span></div>
      </div>

      <div className="mod">
        <div className="xhead">
          <span /><span>영화 · 감독</span><span className="r">정전가</span><span className="cc-h">Cinecodex V·U</span><span className="r">내 ★</span><span className="r">가치 2축</span>
        </div>
        {view.map((f) => {
          const m = gapM(f), a = gapA(f);
          const isFind = (m ?? -99) >= 12, isOver = (m ?? 99) <= -9;
          const rClass = f.r == null ? "" : f.r >= 30 ? "hi" : "";
          return (
            <div key={f.slug} className={`xrow${sel === f.slug ? " sel" : ""}${isFind ? " is-find" : isOver ? " is-over" : ""}`}
              onClick={() => { setSel(f.slug); insp.select(<Insp f={f} />, "인스펙터 · 자산"); }}>
              <span className="xpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}}>
                {f.year ? <span className="yr">{f.year}</span> : null}
              </span>
              <div><div className="xtt">{f.title}</div><div className="xdr">{f.director ?? ""}</div></div>
              <div className="xprice"><div className="pv">{f.prestige != null ? Math.round(f.prestige) : "—"}</div><div className="pl">정전가</div></div>
              <div className={`xcc${f.v == null ? " unrated" : ""}`}>
                <div className="vrow"><span className="vv">{f.v != null ? Math.round(f.v) : "·"}</span><span className="vl">V</span></div>
                <div className="urow">U <b>{f.u ?? "—"}</b></div>
                {f.r != null ? <div className={`rbd ${rClass}`}>R {Math.round(f.r)}</div> : null}
              </div>
              <div className="xstars">
                <div className="st" title={f.rating != null ? `${f.rating}` : ""}>{stars(f.rating)}</div>
                <div className="me">{f.rating != null ? f.rating.toFixed(1) : "미평가"}</div>
              </div>
              <div className="xval"><div className="ax">
                {m != null ? <span className={`xmini ${isFind ? "find" : isOver ? "over" : ""}`}>시장 {m > 0 ? "+" : ""}{m}</span> : null}
                {a != null ? <span className={`xmini ${a >= 12 ? "a-find" : a <= -9 ? "a-over" : ""}`}>분석 {a > 0 ? "+" : ""}{a}</span> : null}
              </div></div>
            </div>
          );
        })}
        {view.length === 0 ? <div style={{ padding: 24, color: "var(--sub)", fontSize: 13 }}>보유작이 없습니다. 영화를 &quot;봤어요&quot;로 표시하면 여기에 자산으로 나타납니다.</div> : null}
      </div>
    </div>
  );
}
