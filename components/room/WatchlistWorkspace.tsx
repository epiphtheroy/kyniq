"use client";
/** 볼 영화 Watchlist — 매수 후보 데스크. WWI 적합도 + 위험(R) 거르기 + λ 다이얼(보수↔모험).
 *  WWI = Confidence·(0.45 Utility + 0.35 Taste + 0.20 Standing). Utility = V − λ·R. */
import { useMemo, useState, useEffect } from "react";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; ts: number | null; prestige: number | null;
  conf: number | null; tier: string | null; sim: number;
  u_util: number; t_taste: number; s_standing: number; wwi: number;
};

const IMG = "https://image.tmdb.org/t/p/w92";
const clamp = (x: number) => Math.max(0, Math.min(1, x));

function reasonsOf(f: WwiRow): { cls: string; label: string }[] {
  const out: { cls: string; label: string }[] = [];
  if (f.r != null && f.r <= 15) out.push({ cls: "safe", label: "안전자산" });
  if (f.t_taste >= 80) out.push({ cls: "reading", label: "취향 적중" });
  if (f.s_standing >= 80) out.push({ cls: "canon", label: "정전 위상" });
  if (f.r != null && f.r >= 20 && f.r < 30 && (f.v ?? 0) >= 75) out.push({ cls: "frontier", label: "안전한 모험" });
  if (out.length === 0) out.push({ cls: "frontier", label: "후보" });
  return out.slice(0, 3);
}

function riskClass(r: number | null) { return r == null ? "" : r <= 15 ? "lo" : r <= 25 ? "mid" : "hi"; }

function Insp({ f, lam }: { f: WwiRow; lam: number }) {
  const u = f.v != null && f.r != null ? Math.round(f.v - lam * f.r) : f.ts;
  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div><div className="seltitle ser">{f.title}</div><div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div></div>
      </div>
      <div className="icard"><h4><i className="ti ti-target-arrow" /> WWI 분해 · 왜 이 추천</h4>
        <div className="crow"><span className="cl">효용 Utility</span><span className="cbar"><i style={{ width: `${f.u_util}%` }} /></span><span className="cvv">{f.u_util}</span></div>
        <div className="crow"><span className="cl">취향 Taste</span><span className="cbar"><i style={{ width: `${f.t_taste}%`, background: "#3B5BA5" }} /></span><span className="cvv">{f.t_taste}</span></div>
        <div className="crow"><span className="cl">정전 Standing</span><span className="cbar"><i style={{ width: `${f.s_standing}%`, background: "#8a6d3b" }} /></span><span className="cvv">{f.s_standing}</span></div>
        <div className="kv" style={{ marginTop: 6 }}><span>WWI 종합</span><b>{f.wwi}</b></div>
        <div className="kv"><span>취향 근접</span><b>{Math.round(f.sim * 100)}%</b></div>
      </div>
      <CinecodexCard d={{ v: f.v, c: null, r: f.r, u, prestige: f.prestige, conf: f.conf, tier: f.tier }} />
      <div className="actbar">
        <div className="actbtn pri">담기</div>
        <div className="actbtn">봤어요</div>
      </div>
    </div>
  );
}

export default function WatchlistWorkspace({ rows }: { rows: WwiRow[] }) {
  const insp = useInspector();
  const [lam, setLam] = useState(1.0);
  const [hideRisk, setHideRisk] = useState(false);
  const [sort, setSort] = useState<"wwi" | "u" | "risk">("wwi");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());

  const ranked = useMemo(() => {
    let a = rows.filter((f) => !gone.has(f.slug));
    if (q.trim()) { const t = q.toLowerCase(); a = a.filter((f) => f.title.toLowerCase().includes(t) || (f.director ?? "").toLowerCase().includes(t)); }
    const withCalc = a.map((f) => {
      const u01 = f.v != null && f.r != null ? clamp((f.v - lam * f.r) / 100) : f.u_util / 100;
      const c01 = (f.conf ?? 40) / 100;
      const wwi = Math.round(100 * c01 * (0.45 * u01 + 0.35 * f.t_taste / 100 + 0.20 * f.s_standing / 100));
      const u = f.v != null && f.r != null ? Math.round(f.v - lam * f.r) : (f.ts ?? 0);
      return { f, wwi, u, hi: (f.r ?? 0) >= 26 };
    });
    withCalc.sort((x, y) => sort === "u" ? y.u - x.u : sort === "risk" ? (x.f.r ?? 99) - (y.f.r ?? 99) : y.wwi - x.wwi);
    return withCalc.filter((x) => !(hideRisk && x.hi)).slice(0, 20);
  }, [rows, lam, hideRisk, sort, q, gone]);

  useEffect(() => {
    const safe = rows.filter((f) => (f.r ?? 99) <= 15).length;
    const bold = rows.filter((f) => (f.r ?? 0) >= 26).length;
    insp.setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-adjustments" /> 후보 데스크 요약</h4>
          <div className="kv"><span>후보(미관람)</span><b>{rows.length}</b></div>
          <div className="kv"><span>안전자산 (R≤15)</span><b>{safe}</b></div>
          <div className="kv"><span>고위험 (R≥26)</span><b>{bold}</b></div>
          <div className="kv"><span>위험선호 λ</span><b>{lam.toFixed(1)}</b></div>
        </div>
        <div className="emptyins">후보를 클릭하면 WWI 분해 · Cinecodex(왜 안전/위험)가 열립니다.</div>
      </div>
    );
  }, [rows, lam, insp]);

  return (
    <div className="mainpad">
      <h1 className="secttl">볼 영화 · 추천 데스크</h1>
      <p className="secsub"><span className="gloss" title="이 영화가 나에게 맞는 정도 0–100">WWI</span> 적합도 + <span className="gloss" title="실망 위험 — 완파 빨강과 다른 색">위험(R)</span> 거르기. λ 다이얼로 보수↔모험을 조절 — <b>효용 = 가치 − λ·위험</b>.</p>

      <div className="toolbar">
        <div className="lambda">
          <span className="lbl">위험선호 λ</span>
          {[[2, "λ2"], [1, "λ1"], [0.5, "λ0.5"]].map(([v, l]) => (
            <span key={l} className={`seg${lam === v ? " on" : ""}`} onClick={() => setLam(v as number)}>{l}</span>
          ))}
        </div>
        <div className={`qtoggle${hideRisk ? " on" : ""}`} onClick={() => setHideRisk((v) => !v)}><span className="dot" style={{ background: "var(--risk)" }} /> 고위험 숨기기</div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as "wwi" | "u" | "risk")}>
          <option value="wwi">정렬 · WWI</option><option value="u">정렬 · 순가치 U</option><option value="risk">정렬 · 저위험</option>
        </select>
        <div className="srch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="후보 검색" /></div>
      </div>

      <div className="mod"><div className="modbody" style={{ padding: 0 }}>
        {ranked.map(({ f, wwi, u, hi }, i) => (
          <div key={f.slug} className={`rrow${sel === f.slug ? " sel" : ""}${hi ? " hirisk" : ""}${kept.has(f.slug) ? " kept" : ""}`}
            onClick={() => { setSel(f.slug); insp.select(<Insp f={f} lam={lam} />, "인스펙터 · 후보"); }}>
            <span className="rk">{i + 1}</span>
            <div>
              <div className="rt ser">{f.title} <small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small>{kept.has(f.slug) ? <span className="keptflag">담음</span> : null}</div>
              <div className="reasons">{reasonsOf(f).map((rn, j) => <span key={j} className={`rsn ${rn.cls}`}>{rn.label}</span>)}</div>
            </div>
            <div className="wwi"><div className="pv" style={{ color: "#86b9ec" }}>{wwi}</div><div className="pl">WWI</div></div>
            <div className="ucol"><div className="uv">{u}</div><div className="ul">U 순가치</div><div className="rrisk">{f.r != null ? <span className={`riskbadge ${riskClass(f.r)}`}>R {Math.round(f.r)}</span> : null}</div></div>
            <div className="dlt">{Math.round(f.sim * 100)}%<small>취향</small></div>
            <div className="rowact">
              <span className={`ria add${kept.has(f.slug) ? " done" : ""}`} title="담기" onClick={(e) => { e.stopPropagation(); setKept((s) => new Set(s).add(f.slug)); }}><i className="ti ti-bookmark-plus" /></span>
              <span className="ria seen" title="봤어요" onClick={(e) => { e.stopPropagation(); setGone((s) => new Set(s).add(f.slug)); }}><i className="ti ti-check" /></span>
              <span className="ria skip" title="관심없음" onClick={(e) => { e.stopPropagation(); setGone((s) => new Set(s).add(f.slug)); }}><i className="ti ti-x" /></span>
            </div>
          </div>
        ))}
        {ranked.length === 0 ? <div style={{ padding: 24, color: "var(--sub)", fontSize: 13 }}>후보가 없습니다. 영화를 더 평가하면 취향 기반 후보가 채워집니다(≥3편 필요).</div> : null}
      </div></div>
    </div>
  );
}
