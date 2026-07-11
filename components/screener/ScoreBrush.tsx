"use client";

/**
 * ScoreBrush — a histogram you drag a range over. Replaces the old twin-slider
 * DualRange: the distribution is visible, so you select against the shape, not
 * blind. Used at two sizes — the main TakeScore brush (height 64) and the 13
 * dimension minis (height 26, static global distribution). Pure SVG in a
 * 0..1000 logical viewBox; pointer maps through the bounding rect, so it's
 * fully responsive. Drag anywhere to select; double-click to clear.
 */
import { useCallback, useRef, useState } from "react";

export type Bucket = { lo: number; n: number };

export default function ScoreBrush({
  buckets, domain, step, value, onChange,
  height = 64, color = "#0F6E56", label,
}: {
  buckets: Bucket[];
  domain: [number, number];
  step: number;
  value: [number, number] | null;
  onChange: (range: [number, number] | null) => void;
  height?: number;
  color?: string;
  label?: string;
}) {
  const [dmin, dmax] = domain;
  const span = dmax - dmin || 1;
  const W = 1000;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ start: number } | null>(null);
  const [live, setLive] = useState<[number, number] | null>(null);
  const sel = live ?? value;

  const maxN = Math.max(1, ...buckets.map((b) => b.n));
  const valToX = (v: number) => ((v - dmin) / span) * W;
  const snap = (v: number) => Math.round(v / step) * step;
  const clamp = (v: number) => Math.min(dmax, Math.max(dmin, v));

  const pointerVal = useCallback((clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return dmin;
    const frac = (clientX - r.left) / r.width;
    return clamp(snap(dmin + frac * span));
  }, [dmin, span]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const v = pointerVal(e.clientX);
    drag.current = { start: v };
    setLive([v, v]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const v = pointerVal(e.clientX);
    const a = Math.min(drag.current.start, v);
    const b = Math.max(drag.current.start, v);
    setLive([a, b]);
  };
  const onUp = () => {
    if (!drag.current) return;
    const cur = live;
    drag.current = null;
    setLive(null);
    if (!cur || cur[1] - cur[0] < step) { onChange(null); return; }        // a tap clears
    if (cur[0] <= dmin && cur[1] >= dmax) { onChange(null); return; }        // whole range = no filter
    onChange([cur[0], cur[1]]);
  };

  const barH = height - 6;
  return (
    <div className="sbr" style={{ height }}>
      <svg
        ref={svgRef} className="sbr-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
        role="slider" aria-label={label ?? "Score range"} aria-valuemin={dmin} aria-valuemax={dmax}
        aria-valuetext={sel ? `${Math.round(sel[0])} to ${Math.round(sel[1])}` : "all"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDoubleClick={() => onChange(null)}
      >
        {buckets.map((b, i) => {
          const x = valToX(b.lo);
          const w = (step / span) * W;
          const h = Math.max(1, (b.n / maxN) * barH);
          const inSel = sel ? b.lo + step / 2 >= sel[0] && b.lo + step / 2 <= sel[1] : true;
          return (
            <rect key={i} x={x + 1} y={height - h - 3} width={Math.max(1, w - 2)} height={h}
              fill={inSel ? color : "#d8d8d8"} rx={1} />
          );
        })}
        {sel ? (
          <>
            <rect x={valToX(sel[0])} y={0} width={Math.max(2, valToX(sel[1]) - valToX(sel[0]))} height={height}
              fill={color} fillOpacity={0.08} stroke={color} strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
    </div>
  );
}
