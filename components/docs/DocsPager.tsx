import Link from "next/link";
import { docHref, docNeighbors } from "@/lib/docs/registry";

/** Prev/next within the flat docs order. Server component (no client JS). */
export default function DocsPager({ slug }: { slug: string }) {
  const { prev, next } = docNeighbors(slug);
  if (!prev && !next) return null;
  return (
    <nav className="mdocs-pager" aria-label="More methodology docs">
      {prev ? (
        <Link href={docHref(prev.slug)} className="mdocs-pager--prev">
          <div className="mdocs-pager__dir">← Previous</div>
          <div className="mdocs-pager__t">{prev.title}</div>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} />
      )}
      {next ? (
        <Link href={docHref(next.slug)} className="mdocs-pager--next">
          <div className="mdocs-pager__dir">Next →</div>
          <div className="mdocs-pager__t">{next.title}</div>
        </Link>
      ) : (
        <span style={{ flex: "1 1 0" }} />
      )}
    </nav>
  );
}
