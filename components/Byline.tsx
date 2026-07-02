import Link from "next/link";

/**
 * Byline — visible top-of-page provenance (Phase 1, 2026-07-02).
 * Complements the bottom <Provenance/>: Google's quality guidance looks for
 * "who made this, how, when" to be immediately visible, so the flagship
 * templates surface it right under the headline. Keep it one quiet line.
 */
function fmt(d?: string | null): string | null {
  if (!d) return null;
  const t = new Date(d);
  if (isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function Byline({ updated, created }: { updated?: string | null; created?: string | null }) {
  const u = fmt(updated) || fmt(created);
  return (
    <p
      className="ui muted"
      style={{ fontSize: 12.5, margin: "6px 0 0", letterSpacing: 0.1 }}
    >
      Drafted by Metatake Editorial · reviewed &amp; edited by{" "}
      <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>
        Wonwoo Yoon
      </Link>
      {u ? <> · updated {u}</> : null}
    </p>
  );
}
