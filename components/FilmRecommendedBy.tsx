import Link from "next/link";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { filmTitle, type TitleMap } from "@/lib/i18n/filmTitles";

/** "Recommended by" — reverse Watch-next graph (films that name this one). Shared by full + catalog film pages. */
export type RevRow = { source_slug: string; source_title: string; source_year: number | null };

export default function FilmRecommendedBy({ rows, title, locale = DEFAULT_LOCALE, titles }: { rows: RevRow[]; title: string; locale?: Locale; titles?: TitleMap }) {
  if (!rows.length) return null;
  return (
    <section className="df-sec" id="df-recby">
      <h2 className="df-h2">{t(locale, "Recommended by")} <span className="rb-n">{rows.length}</span></h2>
      <p className="df-sub">{t(locale, "Films whose viewers Metatake points toward {title} — these {n} films name it among their nine “Watch next” picks.", { title, n: rows.length })}</p>
      <div className="rb-list">
        {rows.map((r, i) => (
          <span key={i} className="rb-item">
            <Link href={`/film/${r.source_slug}`}>{filmTitle(titles ?? new Map(), locale, r.source_slug, r.source_title)}</Link> <span className="rb-yr">({r.source_year ?? "?"})</span>{i < rows.length - 1 ? <span className="rb-sep"> · </span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
