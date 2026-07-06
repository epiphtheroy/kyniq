"use client";

/**
 * MineEntityIndex — the "Only mine" view of an entity index page (films,
 * directors, tropes, concepts, theorists, traditions). When the My Films lens
 * is in only-mode it fetches /api/lens/entities and renders the entities
 * ranked by the signed-in user's seen films, replacing the public list (which
 * the page wraps in .mtl-swap-out — hidden by CSS in only-mode).
 * Off/highlight mode → renders nothing; the public list shows untouched.
 *
 * imgShape picks the media row style: "poster" (films — 2:3 thumb, year shown)
 * or "round" (directors — face circle). Both render as gap-free single-line
 * rows in a responsive 2–3 column grid. Kinds without images keep the plain
 * .th-grid look of their public lists.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLens } from "@/components/LensProvider";

type Row = { slug: string; label: string; sub: string | null; n: number | null; year?: number | null; img?: string | null };
type Kind = "films" | "directors" | "tropes" | "concepts" | "theorists" | "traditions";

const IMG = "https://image.tmdb.org/t/p/w92";

export default function MineEntityIndex({
  kind, hrefBase, noun, filmsNoun = "films", imgShape,
}: { kind: Kind; hrefBase: string; noun: string; filmsNoun?: string; imgShape?: "poster" | "round" }) {
  const lens = useLens();
  const active = !!lens && lens.mode === "only" && lens.seenCount > 0;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!active) { setRows(null); return; }
    let dead = false;
    setErr(false);
    fetch(`/api/lens/entities?kind=${kind}&limit=1000`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!dead) { setRows((d.rows ?? []) as Row[]); setTotal(d.total ?? 0); } })
      .catch(() => { if (!dead) setErr(true); });
    return () => { dead = true; };
  }, [active, kind]);

  if (!active) return null;

  const note = err ? (
    <>Couldn&rsquo;t load your view — try again in a moment.</>
  ) : rows === null ? (
    <>Gathering your {noun}…</>
  ) : kind === "films" ? (
    <>The <b>{total.toLocaleString()}</b> films you&rsquo;ve seen on Metatake — newest first, no gaps.</>
  ) : (
    <><b>{total.toLocaleString()}</b> {noun} appear in the <b>{lens!.seenCount.toLocaleString()}</b> films you&rsquo;ve seen — ranked by how many of yours each one touches.</>
  );

  return (
    <section className="mtl-mine">
      <p className="mtl-mine__note">{note}</p>
      {rows && rows.length > 0 ? (
        imgShape ? (
          <div className="mtl-mine__grid">
            {rows.map((r) => (
              <Link className="mtl-mine__row" href={`${hrefBase}${r.slug}`} key={r.slug} title={r.label}>
                {r.img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className={imgShape === "round" ? "mtl-mine__face" : "mtl-mine__thumb"}
                    src={`${IMG}${r.img}`} alt="" loading="lazy"
                    width={imgShape === "round" ? 34 : 28} height={imgShape === "round" ? 34 : 42}
                  />
                ) : (
                  <span className={`${imgShape === "round" ? "mtl-mine__face" : "mtl-mine__thumb"} mtl-mine__ph`} aria-hidden="true" />
                )}
                <span className="mtl-mine__name">
                  {r.label}
                  {r.year != null ? <span className="mtl-mine__yr">({r.year})</span> : null}
                </span>
                {r.n != null ? <span className="mtl-mine__n">{r.n} {filmsNoun}</span> : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="th-grid">
            {rows.map((r) => (
              <Link className="th-row" href={`${hrefBase}${r.slug}`} key={r.slug}>
                <span className="th-name">{r.label}{r.sub ? <span className="mtl-mine__sub"> · {r.sub}</span> : null}</span>
                <span className="th-n">{r.n} {filmsNoun}</span>
              </Link>
            ))}
          </div>
        )
      ) : rows && rows.length === 0 && !err ? (
        <p className="mtl-mine__note">Nothing yet — mark more films as Seen and this fills in.</p>
      ) : null}
    </section>
  );
}
