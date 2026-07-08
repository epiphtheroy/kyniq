import Link from "next/link";
import { type NowModule, provenanceHref } from "@/lib/now";

/**
 * "The record" — the data layer of a Now Playing piece. Renders the typed
 * modules the pipeline assembled from the corpus (honors, canon appearances,
 * TakeScore, reception arc, filmography, generic table/list). Every cell is
 * data the reader can verify one click away; external hrefs are dropped by
 * safeHref so modules can only link inside the site.
 */

function Cell({ cell }: { cell: string | { text: string; href?: string } }) {
  if (typeof cell === "string") return <>{cell}</>;
  const p = provenanceHref(cell.href);
  if (!p) return <>{cell.text}</>;
  if (p.external) {
    return <a href={p.href} target="_blank" rel="noopener nofollow">{cell.text}</a>;
  }
  return <Link href={p.href}>{cell.text}</Link>;
}

function ModuleBlock({ m }: { m: NowModule }) {
  const hasTable = Array.isArray(m.rows) && m.rows.length > 0;
  const hasList = !hasTable && Array.isArray(m.items) && m.items.length > 0;
  if (!hasTable && !hasList) return null;

  return (
    <section className="now-mod" data-type={m.type}>
      <h3 className="now-mod__t">{m.title}</h3>
      {m.note ? <p className="now-mod__n">{m.note}</p> : null}
      {hasTable ? (
        <div className="now-mod__scroll">
          <table>
            {m.columns?.length ? (
              <thead>
                <tr>{m.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
              </thead>
            ) : null}
            <tbody>
              {m.rows!.map((r, i) => (
                <tr key={i}>{r.map((cell, j) => <td key={j}><Cell cell={cell} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="now-mod__list">
          {m.items!.map((it, i) => {
            const p = provenanceHref(it.href);
            return (
              <li key={i}>
                {!p ? (
                  <span>{it.label}</span>
                ) : p.external ? (
                  <a href={p.href} target="_blank" rel="noopener nofollow">{it.label}</a>
                ) : (
                  <Link href={p.href}>{it.label}</Link>
                )}
                {it.note ? <span className="n"> — {it.note}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function NowModules({ modules }: { modules: NowModule[] }) {
  const usable = (modules ?? []).filter((m) => (m.rows?.length ?? 0) > 0 || (m.items?.length ?? 0) > 0);
  if (!usable.length) return null;
  return (
    <div className="now-record">
      {usable.map((m, i) => <ModuleBlock key={i} m={m} />)}
    </div>
  );
}
