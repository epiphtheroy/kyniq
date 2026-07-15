/**
 * CRM shared presentational helpers — server-component safe (no client hooks).
 * Consumes the CSS vars defined in app/crm/layout.tsx (.crm-wrap).
 */
import type { CSSProperties, ReactNode } from "react";

export const card: CSSProperties = {
  background: "#0b1712",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  padding: "1rem 1.1rem",
};

export function btn(bg: string): CSSProperties {
  return {
    padding: "0.35rem 0.7rem",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 5,
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  };
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: "1.4rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>{title}</h1>
      {sub ? <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>{sub}</p> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", marginBottom: 12, borderBottom: "1px solid var(--hairline)", paddingBottom: 6 }}>
      {children}
    </h2>
  );
}

export function Stat({ label, value, sub, tone, href }: { label: string; value: string | number; sub?: string; tone?: string; href?: string }) {
  const inner = (
    <div style={{ ...card, ...(href ? { cursor: "pointer" } : {}) }}>
      <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, color: tone ?? "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
  if (href) {
    return <a href={href} style={{ textDecoration: "none", display: "block", color: "inherit" }}>{inner}</a>;
  }
  return inner;
}

export function Badge({ text, tone = "#8fb3a0" }: { text: string; tone?: string }) {
  return (
    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: tone, background: "rgba(255,255,255,0.05)", border: `1px solid ${tone}44`, borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

export function Warn({ children, tone = "#fbbf24" }: { children: ReactNode; tone?: string }) {
  return (
    <div style={{ ...card, borderColor: `${tone}66`, background: `${tone}12`, color: tone, fontSize: "0.8rem" }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ ...card, textAlign: "center", color: "var(--muted)" }}>{children}</div>;
}

export function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 0) return "예정";
  if (d < 60) return "방금";
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}
