import Link from "next/link";
import { poeHref, poeNeighbors } from "@/lib/poetics/registry";

/** Prev/next within the flat essay order. Server component. */
export default function PoePager({ slug }: { slug: string }) {
  const { prev, next } = poeNeighbors(slug);
  if (!prev && !next) return null;
  return (
    <nav className="poe-pager" aria-label="More Poetics essays">
      {prev ? (
        <Link href={poeHref(prev.slug)} className="poe-pager--prev">
          <div className="poe-pager__dir">← Previous</div>
          <div className="poe-pager__t">{prev.title}</div>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} />
      )}
      {next ? (
        <Link href={poeHref(next.slug)} className="poe-pager--next">
          <div className="poe-pager__dir">Next →</div>
          <div className="poe-pager__t">{next.title}</div>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} />
      )}
    </nav>
  );
}
