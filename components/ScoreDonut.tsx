import type { CSSProperties } from "react";

/** Shared score donut — the ring gauge from the My Room Appraisal, extracted
 *  so the public TakeScore surfaces (film appraisal page, /takescore curtain,
 *  film-page CinecodexPanel) render the same instrument. Pure SVG, server-safe.
 *  Theme via props: defaults suit the public light theme; the room passes its
 *  dark track/text explicitly. */
export default function ScoreDonut({
  val,
  color,
  label,
  sub,
  size = 86,
  track = "var(--hairline, #E7E4DC)",
  text = "var(--ink, #1B1B1F)",
  subText = "var(--muted, #8A877E)",
}: {
  val: number;
  color: string;
  label?: string;
  sub?: string;
  size?: number;
  track?: string;
  text?: string;
  subText?: string;
}) {
  const r = size * (34 / 86);
  const w = size * (7 / 86);
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, val));
  const off = C * (1 - v / 100);
  const numSize = size * (20 / 86);
  const ofSize = size * (8 / 86);
  return (
    <div className="sdonut" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label} ${Math.round(val)} out of 100` : `${Math.round(val)} out of 100`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={w} />
        {/* .mo-ring draws the arc from empty to `off` on load (app/motion.css).
            --mo-ring-c is the full circumference, i.e. where an empty ring
            sits; the animation's implicit `to` is this element's own offset,
            so the static value below stays the single source of truth. */}
        <circle
          className="mo-ring"
          style={{ "--mo-ring-c": C.toFixed(1) } as CSSProperties}
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"
          strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${c} ${c})`}
        />
        <text x={c} y={c - size * 0.035} textAnchor="middle" fontSize={numSize} fill={text} fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fontWeight={600}>
          {Math.round(val)}
        </text>
        <text x={c} y={c + size * 0.128} textAnchor="middle" fontSize={ofSize} fill={subText} letterSpacing="1">
          /100
        </text>
      </svg>
      {label ? <div className="sdonut-cap" style={{ fontSize: 11.5, fontWeight: 600, color: text, letterSpacing: ".02em" }}>{label}</div> : null}
      {sub ? <div className="sdonut-note" style={{ fontSize: 10.5, color: subText }}>{sub}</div> : null}
    </div>
  );
}
