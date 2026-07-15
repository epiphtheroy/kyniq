/**
 * AdminUI — shared presentational primitives for the dark admin surface.
 * Extracted from app/admin/metrics/page.tsx (2026-07-15) so /admin/usage and
 * /admin/metrics render identically. Palette/styles are byte-for-byte the
 * metrics originals; new props (linkTo/tail, ReactNode values) are additive.
 */
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export type Row = Record<string, string | number | boolean | null>;

export const num: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", paddingLeft: 14 };
export const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginTop: 4 };

export function fmt(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "–";
}

export function Kpi({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}>{children}</div>;
}

/** Horizontal bar list — direct-labeled rows, single sequential hue.
 *  linkD (legacy, metrics): labels are paths → /admin/metrics drilldown.
 *  linkTo: general per-row href. tail: extra node after the label (e.g. a badge). */
export function BarList({
  title, rows, labelKey, valueKey = "n", linkD, linkTo, extra, tail,
}: {
  title: ReactNode;
  rows: Row[];
  labelKey: string;
  valueKey?: string;
  linkD?: number;
  linkTo?: (label: string, row: Row) => string | null;
  extra?: (r: Row) => string;
  tail?: (r: Row) => ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  return (
    <div>
      <SubTitle>{title}</SubTitle>
      {rows.length === 0 && <div style={{ fontSize: 12, color: "#64748b" }}>Nothing yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((r, i) => {
          const v = Number(r[valueKey]) || 0;
          const label = String(r[labelKey] ?? "–");
          const ex = extra ? extra(r) : "";
          const href = linkD ? `/admin/metrics?d=${linkD}&path=${encodeURIComponent(label)}` : linkTo ? linkTo(label, r) : null;
          return (
            <div key={i} style={{ position: "relative", fontSize: 12.5, lineHeight: "22px" }}>
              <div style={{
                position: "absolute", inset: 0, width: `${Math.max(2, (v / max) * 100)}%`,
                background: "rgba(57,135,229,0.16)", borderRadius: 4,
              }} />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 10, padding: "0 8px" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e2e8f0" }}>
                  {href ? (
                    <Link href={href} style={{ color: "#e2e8f0", textDecoration: "none" }}>{label}</Link>
                  ) : label}
                  {tail ? tail(r) : null}
                </span>
                <span style={{ color: "#94a3b8", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {ex && <span style={{ marginRight: 10, color: "#64748b" }}>{ex}</span>}
                  {fmt(v)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
