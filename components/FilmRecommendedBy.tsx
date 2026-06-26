import Link from "next/link";

/** "Recommended by" — reverse Watch-next graph (films that name this one). Shared by full + catalog film pages. */
export type RevRow = { source_slug: string; source_title: string; source_year: number | null };

export default function FilmRecommendedBy({ rows, title }: { rows: RevRow[]; title: string }) {
  if (!rows.length) return null;
  return (
    <section className="df-sec" id="df-recby">
      <h2 className="df-h2">Recommended by <span className="rb-n">{rows.length}</span></h2>
      <p className="df-sub">Films whose viewers Metatake points toward {title} — these {rows.length} films name it among their nine &ldquo;Watch next&rdquo; picks.</p>
      <div className="rb-list">
        {rows.map((r, i) => (
          <span key={i} className="rb-item">
            <Link href={`/film/${r.source_slug}`}>{r.source_title}</Link> <span className="rb-yr">({r.source_year ?? "?"})</span>{i < rows.length - 1 ? <span className="rb-sep"> · </span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
