import type { CSSProperties, ReactNode } from "react";
import type { RelatedBox } from "@/lib/related";

/**
 * RelatedBoxes — server-rendered "keep reading" section (SEO module).
 * Renders ONE themed section; pages map over the RelatedSection[] a
 * lib/related.ts recipe returns.
 *
 * Rules encoded: plain HTML only (no client component, no lazy loading of
 * the section itself), plain <a> links, renders nothing when boxes is empty.
 * Images are dimensioned (w185: 185×278) and loading="lazy". Reuses the
 * global axw-, rcp- and th-grid classes so typography follows the site vars
 * (--font-display / --font-ui).
 *
 * Variants:
 *  - "cards" (default): responsive grid (1 → 2 → 3 columns via th-grid) —
 *    badge line, title, optional meta, full excerpt.
 *  - "rows": compact single-column list — inline badge + title (+ meta),
 *    one-line excerpt (clamped visually; full text stays in the HTML).
 *  - "posters": responsive poster grid (2-col mobile → 3–4-col desktop via
 *    auto-fill) — poster image, badge, title, one-line meta + excerpt.
 */

type Props = {
  boxes: RelatedBox[];
  heading?: string;
  variant?: "cards" | "rows" | "posters";
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

const oneLineStyle: CSSProperties = {
  display: "block",
  letterSpacing: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export default function RelatedBoxes({ boxes, heading = "Keep reading on Metatake", variant = "cards" }: Props) {
  if (boxes.length === 0) return null;
  const headingId = "rb-" + heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  let body: ReactNode;
  if (variant === "posters") {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: "18px 14px", marginTop: 10 }}>
        {boxes.map((b) => (
          <a key={b.href} href={b.href} style={boxLinkStyle}>
            {b.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.image}
                alt={`${b.title} poster`}
                width={185}
                height={278}
                loading="lazy"
                style={{ width: "100%", height: "auto", display: "block", background: "#1a1f25" }}
              />
            ) : null}
            <span style={{ ...badgeStyle, marginTop: 7 }}>{b.kind}</span>
            <strong className="rcp-h" style={{ fontSize: 13.5, lineHeight: 1.3, marginTop: 1 }}>{b.title}</strong>
            {b.meta ? <span className="rcp-m" style={{ display: "block", marginTop: 2 }}>{b.meta}</span> : null}
            {b.excerpt ? <span className="rcp-m" style={{ ...oneLineStyle, marginTop: 2 }}>{b.excerpt}</span> : null}
          </a>
        ))}
      </div>
    );
  } else if (variant === "rows") {
    body = (
      <div className="rcp-list" style={{ gridTemplateColumns: "1fr" }}>
        {boxes.map((b) => (
          <a key={b.href} href={b.href} className="rcp-row" style={boxLinkStyle}>
            <span style={{ ...badgeStyle, display: "inline-block", marginRight: 8 }}>{b.kind}</span>
            <strong className="rcp-h" style={{ display: "inline" }}>{b.title}</strong>
            {b.meta ? <span className="rcp-m" style={{ marginLeft: 8 }}>{b.meta}</span> : null}
            {b.excerpt ? (
              <span className="rcp-m" style={{ ...oneLineStyle, marginTop: 3, fontSize: 12.5 }}>{b.excerpt}</span>
            ) : null}
          </a>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="th-grid">
        {boxes.map((b) => (
          <a key={b.href} href={b.href} className="rcp-row" style={boxLinkStyle}>
            <span style={badgeStyle}>{b.kind}</span>
            <strong className="rcp-h" style={{ marginTop: 2 }}>{b.title}</strong>
            {b.meta ? <span className="rcp-m" style={{ display: "block", marginTop: 2 }}>{b.meta}</span> : null}
            {b.excerpt ? (
              <span className="rcp-m" style={{ display: "block", marginTop: 4, fontSize: 13, lineHeight: 1.55, letterSpacing: 0 }}>
                {b.excerpt}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    );
  }

  return (
    <section className="axw-section" aria-labelledby={headingId}>
      <h2 className="axw-h2" id={headingId}>{heading}</h2>
      {body}
    </section>
  );
}
