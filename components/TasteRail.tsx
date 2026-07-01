import Link from "next/link";

/** /me — "Recommended for you" by taste. Nearest UNSEEN films to your loved-film
 *  signature (take-embedding centroid of films you rated ≥ 3.5), shown with their
 *  TakeScore. Blends the personal axis (taste) with the objective one (TakeScore). */
export type TasteRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; prestige: number | null; sim: number;
};

const IMG = "https://image.tmdb.org/t/p/w185";

export default function TasteRail({ rows }: { rows: TasteRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="tr2">
      <ul className="tr2-grid">
        {rows.map((f) => {
          const ts = f.v != null && f.r != null ? Math.round(f.v - f.r) : null;
          return (
            <li className="tr2-card" key={f.slug}>
              <Link href={`/film/${f.slug}`}>
                {f.poster_path
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img className="tr2-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
                  : <span className="tr2-th tr2-th--e" />}
                <div className="tr2-b">
                  <div className="tr2-t">{f.title}</div>
                  <div className="tr2-sub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div>
                  <div className="tr2-m">
                    {ts != null ? <span className="tr2-ts">TS {ts}</span> : null}
                    <span className="tr2-match">{Math.round(f.sim * 100)}% your taste</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
