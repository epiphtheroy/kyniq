"use client";

/** The Codex — value-vs-risk discovery. λ risk-aversion dial, sort modes, a value/risk scatter,
 *  and a ranked grid. All client-side over the pre-fetched score set. */
import { useMemo, useState } from "react";
import Link from "next/link";

const IMG = "https://image.tmdb.org/t/p/w154";
export type CodexRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; v: number; c: number; r: number; u: number; sharpe: number };

type Sort = "u" | "v" | "sharpe" | "lowrisk";
const SORTS: { id: Sort; label: string }[] = [
  { id: "u", label: "Net value (V − λ·R)" }, { id: "v", label: "Pure value (V)" },
  { id: "sharpe", label: "Efficiency (value / risk)" }, { id: "lowrisk", label: "Lowest risk" },
];

export default function CodexExplorer({ rows }: { rows: CodexRow[] }) {
  const [sort, setSort] = useState<Sort>("u");
  const [lam, setLam] = useState(1.0);
  const [maxC, setMaxC] = useState(100);

  const filtered = useMemo(() => rows.filter((f) => f.c <= maxC), [rows, maxC]);
  const ranked = useMemo(() => {
    const key = (f: CodexRow) => sort === "v" ? f.v : sort === "sharpe" ? f.sharpe : sort === "lowrisk" ? -f.r : f.v - lam * f.r;
    return filtered.slice().sort((a, b) => key(b) - key(a));
  }, [filtered, sort, lam]);
  const grid = ranked.slice(0, 120);

  // scatter: x = risk (0..~60), y = value (0..100 inverted). color by net value.
  const W = 640, H = 320, PAD = 28, RMAX = 60;
  const sx = (r: number) => PAD + (Math.min(r, RMAX) / RMAX) * (W - 2 * PAD);
  const sy = (v: number) => PAD + (1 - v / 100) * (H - 2 * PAD);
  const col = (u: number) => u >= 70 ? "#0F6E56" : u >= 45 ? "#5b8a72" : u >= 20 ? "#b08900" : "#C8102E";

  return (
    <>
      <div className="cx-controls">
        <div className="cx-seg">
          {SORTS.map((s) => <button key={s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>{s.label}</button>)}
        </div>
        <label className="cx-dial">Risk-aversion λ <b>{lam.toFixed(1)}</b>
          <input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} disabled={sort !== "u"} />
        </label>
        <label className="cx-dial">Max entry cost <b>{maxC}</b>
          <input type="range" min={20} max={100} step={5} value={maxC} onChange={(e) => setMaxC(parseInt(e.target.value))} />
        </label>
        <span className="cx-count">{filtered.length} films</span>
      </div>

      <div className="cx-scatter">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Value vs risk scatter">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="cx-ax" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="cx-ax" />
          <text x={W - PAD} y={H - 8} textAnchor="end" className="cx-axl">risk →</text>
          <text x={6} y={PAD} className="cx-axl">value ↑</text>
          {filtered.map((f) => (
            <circle key={f.slug} cx={sx(f.r)} cy={sy(f.v)} r={2.2} fill={col(f.u)} opacity={0.62}>
              <title>{f.title} ({f.year}) · V{f.v} R{f.r} · U{f.u}</title>
            </circle>
          ))}
        </svg>
        <p className="cx-legend"><i style={{ background: "#0F6E56" }} /> high net value &nbsp; <i style={{ background: "#b08900" }} /> middling &nbsp; <i style={{ background: "#C8102E" }} /> risky / low</p>
      </div>

      <div className="cx-grid">
        {grid.map((f, i) => (
          <Link className="cx-card" href={`/film/${f.slug}`} key={f.slug}>
            <span className="cx-rank">{i + 1}</span>
            {f.poster_path
              ? // eslint-disable-next-line @next/next/no-img-element
                <img className="cx-poster" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
              : <div className="cx-poster cx-poster--e" />}
            <div className="cx-meta">
              <div className="cx-title">{f.title}{f.year ? <span className="cx-yr"> ({f.year})</span> : null}</div>
              <div className="cx-nums"><b>U {sort === "u" ? (f.v - lam * f.r).toFixed(0) : f.u}</b><span>V {f.v}</span><span>C {f.c}</span><span>R {f.r}</span></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
