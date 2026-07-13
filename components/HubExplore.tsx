import Link from "next/link";
import { hubExploreData, type HubKind } from "@/lib/hubExplore";

/**
 * HubExplore — the "Keep exploring" footer for entity/category hub pages
 * (genre / lineage / frame / tradition / movement / person). Renders sideways
 * navigation (sibling entities of the same kind) plus up-links (the index hub
 * and adjacent layers). Server component, plain <Link>, styled with the global
 * df-* classes so no per-page stylesheet is needed. Renders nothing if there is
 * nothing to show. Data + SEO gating live in lib/hubExplore.ts (cached per slug).
 */
export default async function HubExplore({ kind, slug }: { kind: HubKind; slug: string }) {
  const data = await hubExploreData(kind, slug);
  if (!data) return null;
  const { intro, siblings, browse, crossLinks } = data;

  return (
    <section aria-label="Keep exploring" style={{ borderTop: "2px solid #16233F", marginTop: 44, paddingTop: 10 }}>
      <h2 className="df-h2" style={{ marginTop: 16, fontSize: 24 }}>Keep exploring</h2>
      <p className="df-sub" style={{ marginBottom: siblings.length ? 14 : 8 }}>{intro}</p>

      {siblings.length > 0 ? (
        <p style={{ lineHeight: 2, margin: "0 0 4px" }}>
          {siblings.map((s, i) => (
            <span key={s.href}>
              {i > 0 ? " · " : ""}
              <Link href={s.href}>{s.label}</Link>
              {s.meta ? <span style={{ opacity: 0.55, fontSize: 13 }}> ({s.meta})</span> : null}
            </span>
          ))}
        </p>
      ) : null}

      <p style={{ marginTop: 14, lineHeight: 1.9 }}>
        <Link href={browse.href}>{browse.label} →</Link>
        {crossLinks.map((c) => (
          <span key={c.href}><br /><Link href={c.href}>{c.label} →</Link></span>
        ))}
      </p>
    </section>
  );
}
