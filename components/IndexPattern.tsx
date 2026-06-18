"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ---- shared types (also used by /film, /tropes, /director indexes in W2) ---- */
export type IdxCase = {
  f: string;
  y: number | null;
  bd: string | null;
  fs: string;
  fig: string | null;
  figslug: string | null;
};
export type IdxFeature = {
  slug: string;
  title: string;
  lac: string | null;
  thesis: string | null;
  n: number;
  reg: string | null;
  family: string | null;
  cases: IdxCase[];
};
export type IdxItem = { slug: string; title: string; films: number; created_at: string | null };

type SortMode = "alpha" | "films" | "new";

const REG_LABEL: Record<string, string> = {
  formal: "Formal", semiotic: "Semiotic", psychoanalytic: "Psychoanalytic",
  ideological: "Ideological", politico_economic: "Politico-economic",
  philosophical: "Philosophical", existential: "Existential", mythic: "Mythic",
  genealogical: "Film-historical", reception: "Reception",
};
const REG_COLOR: Record<string, string> = {
  formal: "#5B8FB9", semiotic: "#B8860B", psychoanalytic: "#A8434F",
  ideological: "#C0392B", politico_economic: "#2E7D5B", philosophical: "#7E57C2",
  existential: "#546E7A", mythic: "#A9743B", genealogical: "#2E86C1", reception: "#159A8A",
};

const IMG = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w300${p}` : null);
const DECK_N = 4;

/* article-insensitive sort key */
function sortKey(t: string): string {
  return t.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim();
}
function letterOf(t: string): string {
  const c = sortKey(t).charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function pickBatch(total: number, n: number, prev: number[]): number[] {
  if (total <= n) return Array.from({ length: total }, (_, i) => i);
  const avoid = new Set(prev);
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !avoid.has(i));
  const src = pool.length >= n ? pool : Array.from({ length: total }, (_, i) => i);
  for (let i = src.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [src[i], src[j]] = [src[j], src[i]];
  }
  return src.slice(0, n).sort((a, b) => a - b);
}

export default function IndexPattern({
  featured,
  catalogue,
  rowBase,
  unit = "films",
  defaultSort = "alpha",
}: {
  featured: IdxFeature[];
  catalogue: IdxItem[];
  rowBase: string; // e.g. "/take" -> row links to `${rowBase}/${slug}`
  unit?: string;
  defaultSort?: SortMode;
}) {
  /* ============ DECK ============ */
  const [batch, setBatch] = useState<number[]>(() => pickBatch(featured.length, DECK_N, []));
  const k = batch.length;
  const [order, setOrder] = useState<number[]>(() => batch.map((_, i) => i));
  const [flying, setFlying] = useState<number | null>(null);
  const busy = useRef(false);
  const paused = useRef(false);
  const batchRef = useRef(batch);
  batchRef.current = batch;

  const advance = useCallback(() => {
    if (busy.current || k < 2) return;
    busy.current = true;
    setFlying(order[0]);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlying(null);
      busy.current = false;
    }, 480);
  }, [order, k]);

  const reverse = useCallback(() => {
    if (busy.current || k < 2) return;
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
  }, [k]);

  const setFront = useCallback((bp: number) => {
    setOrder((o) => {
      const i = o.indexOf(bp);
      if (i <= 0) return o;
      return [...o.slice(i), ...o.slice(0, i)];
    });
  }, []);

  const newBatch = useCallback(() => {
    const nb = pickBatch(featured.length, DECK_N, batchRef.current);
    setBatch(nb);
    setOrder(nb.map((_, i) => i));
  }, [featured.length]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const newBatchRef = useRef(newBatch);
  newBatchRef.current = newBatch;

  useEffect(() => {
    if (featured.length < 2) return;
    const a = window.setInterval(() => { if (!paused.current) advanceRef.current(); }, 7000);
    const b = window.setInterval(() => { if (!paused.current) newBatchRef.current(); }, 300000);
    return () => { window.clearInterval(a); window.clearInterval(b); };
  }, [featured.length]);

  const cardStyle = (bp: number): CSSProperties => {
    const depth = order.indexOf(bp);
    if (flying === bp) {
      return { transform: "translate3d(135%,-6px,0) rotateY(-24deg)", opacity: 0, zIndex: k + 1, transition: "transform .48s cubic-bezier(.4,0,.2,1), opacity .48s" };
    }
    const lift = depth * 10;
    const scale = 1 - depth * 0.03;
    return {
      transform: `translate3d(0,${lift}px,0) scale(${scale})`,
      opacity: depth > 3 ? 0 : 1 - depth * 0.06,
      zIndex: k - depth,
      transition: "transform .5s cubic-bezier(.4,0,.2,1), opacity .5s",
      pointerEvents: depth === 0 ? "auto" : "none",
    };
  };

  const frontBp = order[0];

  /* ============ CATALOGUE ============ */
  const [sort, setSort] = useState<SortMode>(defaultSort);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? catalogue.filter((c) => c.title.toLowerCase().includes(needle)) : catalogue;
    return base;
  }, [catalogue, q]);

  const azGroups = useMemo(() => {
    if (sort !== "alpha") return null;
    const m = new Map<string, IdxItem[]>();
    for (const it of filtered) {
      const L = letterOf(it.title);
      const arr = m.get(L) ?? [];
      arr.push(it);
      m.set(L, arr);
    }
    return AZ.filter((L) => m.has(L)).map((L) => ({
      L,
      items: (m.get(L) as IdxItem[]).sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title))),
    }));
  }, [filtered, sort]);

  const flatSorted = useMemo(() => {
    if (sort === "alpha") return null;
    const arr = [...filtered];
    if (sort === "films") arr.sort((a, b) => b.films - a.films || sortKey(a.title).localeCompare(sortKey(b.title)));
    else arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return arr;
  }, [filtered, sort]);

  const presentLetters = useMemo(() => new Set((azGroups ?? []).map((g) => g.L)), [azGroups]);

  const rowMeta = (it: IdxItem) =>
    sort === "new"
      ? (it.created_at ? new Date(it.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—")
      : `${it.films} ${unit}`;

  return (
    <>
      {/* deck controls */}
      {featured.length > 0 && (
        <>
          <div className="idx-kick">
            <span className="die">⛛ At random</span>
            <span className="auto"><i />auto-rotating</span>
            <span className="idx-ctl">
              <span className="idx-dots">
                {batch.map((_, bp) => (
                  <button key={bp} aria-label={`card ${bp + 1}`} data-on={bp === frontBp ? "" : undefined} onClick={() => setFront(bp)} />
                ))}
              </span>
              <button className="idx-arw" aria-label="previous" onClick={reverse}>‹</button>
              <button className="idx-arw" aria-label="next" onClick={advance}>›</button>
              <button className="idx-roll" onClick={newBatch}>Reshuffle</button>
            </span>
          </div>

          <div className="idx-deckwrap" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
            <div className="idx-deck">
              {batch.map((featIdx, bp) => {
                const ft = featured[featIdx];
                if (!ft) return null;
                return (
                  <article key={ft.slug} className="idx-dcard" style={cardStyle(bp)} aria-hidden={bp !== frontBp}>
                    <h2>
                      <Link href={`${rowBase}/${ft.slug}`}>{ft.title}</Link>
                      <span className="cnt">{ft.n} {unit}</span>
                    </h2>
                    {ft.lac && <p className="idx-lac">“{ft.lac}”</p>}
                    {ft.thesis && <p className="idx-thesis">{ft.thesis}</p>}

                    {ft.cases.length > 0 && (
                      <>
                        <p className="idx-lbl">Seen in <span className="h">a reading recurs across these films, reached through a different figure each time</span></p>
                        <div className="idx-cases">
                          {ft.cases.slice(0, 4).map((c, i) => (
                            <Link key={i} href={c.figslug ? `/film/${c.fs}/figure/${c.figslug}` : `/film/${c.fs}`} className="idx-case">
                              <span className="idx-thumb">{IMG(c.bd) && <img src={IMG(c.bd) as string} alt="" loading="lazy" />}</span>
                              <span className="tx">
                                <span className="idx-cf">{c.f}{c.y ? <span className="yr"> · {c.y}</span> : null}</span>
                                {c.fig && <span className="idx-cv"><span className="vv">via</span> <span className="fig">{c.fig}</span></span>}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="idx-tags">
                      {ft.reg && (
                        <span className="idx-tag"><i style={{ background: REG_COLOR[ft.reg] ?? "var(--subtle)" }} />{REG_LABEL[ft.reg] ?? ft.reg}</span>
                      )}
                      {ft.family && <span className="idx-tag">{ft.family}</span>}
                    </div>

                    <Link href={`${rowBase}/${ft.slug}`} className="idx-readmore">Read the meta take →</Link>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* catalogue */}
      <div className="idx-listhead">
        <div className="t">The full catalogue</div>
        <p className="sub">Every published meta take. Sorted A–Z by default; articles (the, a, an) ignored.</p>
      </div>

      <div className="idx-tabs">
        <span className="l">Sort</span>
        <button data-on={sort === "alpha" ? "" : undefined} onClick={() => setSort("alpha")}>A–Z</button>
        <button data-on={sort === "films" ? "" : undefined} onClick={() => setSort("films")}>Most {unit}</button>
        <button data-on={sort === "new" ? "" : undefined} onClick={() => setSort("new")}>Newest</button>
        <span className="tot">{filtered.length}{q ? ` of ${catalogue.length}` : ""}</span>
      </div>

      <input className="idx-filter" placeholder="Filter the catalogue…" value={q} onChange={(e) => setQ(e.target.value)} />

      {sort === "alpha" && (
        <div className="idx-azbar">
          {AZ.map((L) => (
            presentLetters.has(L)
              ? <a key={L} href={`#az-${L === "#" ? "0" : L}`}>{L}</a>
              : <a key={L} className="off">{L}</a>
          ))}
        </div>
      )}

      {q.trim() !== "" && filtered.length === 0 && <p className="idx-empty">Nothing matches “{q}”.</p>}

      {sort === "alpha" && azGroups?.map((g) => (
        <section key={g.L} id={`az-${g.L === "#" ? "0" : g.L}`} className="idx-grp">
          <div className="idx-grph">{g.L} <span className="gc">{g.items.length}</span></div>
          <div className="idx-fcols">
            {g.items.map((it) => (
              <Link key={it.slug} href={`${rowBase}/${it.slug}`} className="idx-fcell">
                <span className="ft">{it.title}</span>
                <span className="fd">{rowMeta(it)}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {sort !== "alpha" && flatSorted && (
        <div className="idx-fcols" style={{ marginTop: 16 }}>
          {flatSorted.map((it) => (
            <Link key={it.slug} href={`${rowBase}/${it.slug}`} className="idx-fcell">
              <span className="ft">{it.title}</span>
              <span className="fd">{rowMeta(it)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
