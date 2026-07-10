"use client";

/**
 * Time-series chart for /admin/metrics — pageviews + visitors.
 * Hand-rolled SVG: two 2px lines on a recessive grid, hover crosshair with a
 * tooltip, legend above (identity never carried by color alone — the legend
 * names both series; values live in the tooltip in ink, not series color).
 * Palette (validated on the admin #1e293b surface): blue #3987e5 / aqua #199e70.
 */

import { useRef, useState } from "react";

export type MetricsPoint = { b: string; pv: number; vis: number };

const BLUE = "#3987e5";
const AQUA = "#199e70";
const INK = "#e2e8f0";
const MUTED = "#94a3b8";
const GRID = "rgba(148,163,184,0.15)";

export default function MetricsChart({ data, height = 230 }: { data: MetricsPoint[]; height?: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const W = 960;
  const H = height;
  const P = { t: 14, r: 14, b: 26, l: 48 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  if (!data.length) {
    return <div style={{ color: MUTED, fontSize: 13, padding: "2rem 0" }}>No data in this range yet.</div>;
  }

  const maxY = Math.max(1, ...data.map((d) => d.pv));
  const x = (i: number) => P.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => P.t + ih - (v / maxY) * ih;
  const line = (key: "pv" | "vis") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
  const area = `${line("pv")}L${x(data.length - 1).toFixed(1)},${(P.t + ih).toFixed(1)}L${x(0).toFixed(1)},${(P.t + ih).toFixed(1)}Z`;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxY * f));
  const xTickIdx = data.length <= 8 ? data.map((_, i) => i) : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - P.l) / iw) * (data.length - 1));
    setHi(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hi != null ? data[hi] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 18, fontSize: 12, color: MUTED, marginBottom: 6 }}>
        <span><i style={dot(BLUE)} /> Pageviews</span>
        <span><i style={dot(AQUA)} /> Visitors</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHi(null)}
        role="img"
        aria-label="Pageviews and visitors over time"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {v.toLocaleString()}
            </text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
            {data[i].b}
          </text>
        ))}
        <path d={area} fill={BLUE} opacity={0.08} />
        <path d={line("pv")} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />
        <path d={line("vis")} fill="none" stroke={AQUA} strokeWidth={2} strokeLinejoin="round" />
        {h && hi != null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={P.t} y2={P.t + ih} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hi)} cy={y(h.pv)} r={4} fill={BLUE} stroke="#1e293b" strokeWidth={2} />
            <circle cx={x(hi)} cy={y(h.vis)} r={4} fill={AQUA} stroke="#1e293b" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hi != null && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hi) / W) * 100}%`,
            top: 24,
            transform: `translateX(${hi > data.length / 2 ? "calc(-100% - 10px)" : "10px"})`,
            background: "#0f172a",
            border: `1px solid ${GRID}`,
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: INK,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          <div style={{ color: MUTED, marginBottom: 2 }}>{h.b}</div>
          <div style={{ fontVariantNumeric: "tabular-nums" }}><i style={dot(BLUE)} /> {h.pv.toLocaleString()} pageviews</div>
          <div style={{ fontVariantNumeric: "tabular-nums" }}><i style={dot(AQUA)} /> {h.vis.toLocaleString()} visitors</div>
        </div>
      )}
    </div>
  );
}

function dot(c: string): React.CSSProperties {
  return { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c, marginRight: 5 };
}
