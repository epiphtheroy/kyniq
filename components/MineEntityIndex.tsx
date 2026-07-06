"use client";

/**
 * MineEntityIndex — the "Only mine" view of an entity index page (tropes,
 * concepts, theorists, traditions, directors). When the My Films lens is in
 * only-mode it fetches /api/lens/entities and renders the entities ranked by
 * how many of YOUR seen films each one touches, replacing the public list
 * (which the page wraps in .mtl-swap-out — hidden by CSS in only-mode).
 * Off/highlight mode → renders nothing; the public list shows untouched.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLens } from "@/components/LensProvider";

type Row = { slug: string; label: string; sub: string | null; n: number };
type Kind = "tropes" | "concepts" | "theorists" | "traditions" | "directors";

export default function MineEntityIndex({
  kind, hrefBase, noun, filmsNoun = "films",
}: { kind: Kind; hrefBase: string; noun: string; filmsNoun?: string }) {
  const lens = useLens();
  const active = !!lens && lens.mode === "only" && lens.seenCount > 0;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!active) { setRows(null); return; }
    let dead = false;
    setErr(false);
    fetch(`/api/lens/entities?kind=${kind}&limit=500`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!dead) { setRows((d.rows ?? []) as Row[]); setTotal(d.total ?? 0); } })
      .catch(() => { if (!dead) setErr(true); });
    return () => { dead = true; };
  }, [active, kind]);

  if (!active) return null;

  return (
    <section className="mtl-mine">
      <p className="mtl-mine__note">
        {err ? (
          <>Couldn&rsquo;t load your view — try again in a moment.</>
        ) : rows === null ? (
          <>Ranking {noun} across your films…</>
        ) : (
          <><b>{total.toLocaleString()}</b> {noun} appear in the <b>{lens!.seenCount.toLocaleString()}</b> films you&rsquo;ve seen — ranked by how many of yours each one touches.</>
        )}
      </p>
      {rows && rows.length > 0 ? (
        <div className="th-grid">
          {rows.map((r) => (
            <Link className="th-row" href={`${hrefBase}${r.slug}`} key={r.slug}>
              <span className="th-name">{r.label}{r.sub ? <span className="mtl-mine__sub"> · {r.sub}</span> : null}</span>
              <span className="th-n">{r.n} {filmsNoun}</span>
            </Link>
          ))}
        </div>
      ) : rows && rows.length === 0 && !err ? (
        <p className="mtl-mine__note">Nothing yet — mark more films as Seen and this fills in.</p>
      ) : null}
    </section>
  );
}
