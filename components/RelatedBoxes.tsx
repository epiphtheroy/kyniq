import type { CSSProperties } from "react";
import type { RelatedBox } from "@/lib/related";

/**
 * RelatedBoxes — server-rendered "keep reading" section (SEO module).
 * Renders ONE themed section; pages map over the RelatedSection[] a
 * lib/related.ts recipe returns.
 *
 * Rules encoded: plain HTML only (no client component, no lazy loading),
 * plain <a> links, renders nothing when boxes is empty. Reuses the global
 * axw-*/rcp-* classes from the /whereto "Read closely on Metatake" block so
 * typography follows the site vars (--font-display / --font-ui).
 *
 * Variants:
 *  - "cards" (default): responsive grid — badge line, title, full excerpt.
 *  - "rows": compact single-column list — inline badge + title, one-line
 *    excerpt (clamped visually; full text stays in the HTML for crawlers).
 */

type Props = {
  boxes: RelatedBox[];
  heading?: string;
  variant?: "cards" | "rows";
};

const badgeStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--subtle)",
};

const boxLinkStyle: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

export default function RelatedBoxes({ boxes, heading = "Keep reading on Metatake", variant = "cards" }: Props) {
  if (boxes.length === 0) return null;
  const headingId = "rb-" + heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const rows = variant === "rows";
  return (
    <section className="axw-section" aria-labelledby={headingId}>
      <h2 className="axw-h2" id={headingId}>{heading}</h2>
      <div className="rcp-list" style={rows ? { gridTemplateColumns: "1fr" } : undefined}>
        {boxes.map((b) => (
          <a key={b.href} href={b.href} className="rcp-row" style={boxLinkStyle}>
            {rows ? (
              <>
                <span style={{ ...badgeStyle, display: "inline-block", marginRight: 8 }}>{b.kind}</span>
                <strong className="rcp-h" style={{ display: "inline" }}>{b.title}</strong>
                {b.excerpt ? (
                  <span
                    className="rcp-m"
                    style={{ display: "block", marginTop: 3, fontSize: 12.5, letterSpacing: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {b.excerpt}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span style={badgeStyle}>{b.kind}</span>
                <strong className="rcp-h" style={{ marginTop: 2 }}>{b.title}</strong>
                {b.excerpt ? (
                  <span className="rcp-m" style={{ display: "block", marginTop: 4, fontSize: 13, lineHeight: 1.55, letterSpacing: 0 }}>
                    {b.excerpt}
                  </span>
                ) : null}
              </>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
