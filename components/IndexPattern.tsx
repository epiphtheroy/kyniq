"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import Link from "next/link";

/* ---- shared types (reused by /film, /tropes, /director indexes in W2) ---- */
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
  theorist: string | null;
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

const IMG = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w342${p}` : null);
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
  noun = "meta takes",
  defaultSort = "alpha",
  catalogueTitle = "The full catalogue of meta takes",
  catalogueSub = "Every meta take on Metatake. Click any one to open the reading and the films that gather under it.",
  filterPlaceholder = "Filter meta takes…",
  emptyText = "No meta take matches that.",
  seedSummary = "Just seeded — meta takes waiting for their first film",
  seedNote = "These readings exist as concepts but haven't been connected to a film yet. Spot one in a movie? Open it and add the first take — you'll be the reading's founder.",
}: {
  featured: IdxFeature[];
  catalogue: IdxItem[];
  rowBase: string; // row + card links resolve to `${rowBase}/${slug}`
  unit?: string;
  noun?: string;
  defaultSort?: SortMode;
  catalogueTitle?: string;
  catalogueSub?: string;
  filterPlaceholder?: string;
  emptyText?: string;
  seedSummary?: string;
  seedNote?: string;
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
    }, 520);
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

  /* v4 stacking: fan right + down, scale + fade by depth; front flies off right */
  const cardStyle = (bp: number): CSSProperties => {
    const p = order.indexOf(bp);
    if (flying === bp) {
      return {
        transform: "translate3d(135%,-6px,0) rotateY(-24deg) scale(.95)",
        opacity: 0, zIndex: 61, pointerEvents: "none",
        transition: "transform .55s cubic-bezier(.5,0,.3,1), opacity .55s",
      };
    }
    return {
      transform: p === 0
        ? "translate3d(0,0,0) scale(1)"
        : `translate3d(${p * 15}px,${p * 9}px,0) scale(${1 - p * 0.045})`,
      opacity: p === 0 ? 1 : 1 - p * 0.16,
      zIndex: 60 - p,
      pointerEvents: p === 0 ? "auto" : "none",
      transition: "transform .55s cubic-bezier(.4,0,.2,1), opacity .55s",
    };
  };

  const frontBp = order[0];

  /* ============ CATALOGUE ============ */
  const [sort, setSort] = useState<SortMode>(defaultSort);
  const [q, setQ] = useState("");

  const withFilms = useMemo(() => catalogue.filter((c) => c.films > 0), [catalogue]);
  const seeded = useMemo(
    () => catalogue.filter((c) => c.films <= 0).sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title))),
    [catalogue]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? withFilms.filter((c) => c.title.toLowerCase().includes(needle)) : withFilms;
  }, [withFilms, q]);

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

  const fadeRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("idx-on"); };
  const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("idx-on");

  return (
    <>
      {/* ---- feature deck ---- */}
      {featured.length > 0 && (
        <>
          <div className="idx-kick">
            <span className="die">🎲 Readings, at random</span>
            <span className="auto"><i />turning · a fresh set of {DECK_N} every 5 min</span>
            <span className="idx-ctl">
              <button className="idx-arw" aria-label="previous" onClick={reverse}>‹</button>
              <span className="idx-dots">
                {batch.map((_, bp) => (
                  <button key={bp} aria-label={`card ${bp + 1}`} data-on={bp === frontBp ? "" : undefined} onClick={() => setFront(bp)} />
                ))}
              </span>
              <button className="idx-arw" aria-label="next" onClick={advance}>›</button>
              <button className="idx-roll" onClick={newBatch}>↻ new set</button>
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
                    {ft.lac && <p className="idx-lac">{ft.lac}</p>}
                    {ft.thesis && <p className="idx-thesis">{ft.thesis}</p>}

                    {ft.cases.length > 0 && (
                      <>
                        <div className="idx-lbl">Defining cases <span className="h">— the film, and the figure that carries the reading</span></div>
                        <div className="idx-cases">
                          {ft.cases.slice(0, 5).map((c, i) => (
                            <Link key={i} href={c.figslug ? `/film/${c.fs}/figure/${c.figslug}` : `/film/${c.fs}`} className="idx-case">
                              <span className="tx">
                                <span className="idx-cf">{c.f} {c.y ? <span className="yr">({c.y})</span> : null}</span>
                                {c.fig && <span className="idx-cv"><span className="vv">via</span> <span className="fig">{c.fig}</span></span>}
                              </span>
                              <span className="idx-thumb">
                                {IMG(c.bd) && <img ref={fadeRef} onLoad={onImgLoad} src={IMG(c.bd) as string} alt={c.f} loading="lazy" />}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="idx-tags">
                      {ft.family && (<><span className="idx-tag axis">theory</span><span className="idx-tag">{ft.family}</span></>)}
                      {ft.reg && (<><span className="idx-tag axis">register</span><span className="idx-tag"><i style={{ background: REG_COLOR[ft.reg] ?? "var(--subtle)" }} />{REG_LABEL[ft.reg] ?? ft.reg}</span></>)}
                      {ft.theorist && (<><span className="idx-tag axis">theorist</span><span className="idx-tag">{ft.theorist}</span></>)}
                    </div>

                    <Link href={`${rowBase}/${ft.slug}`} className="idx-readmore">Open the meta-take <span aria-hidden="true">→</span></Link>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ---- catalogue ---- */}
      <div className="idx-listhead">
        <div className="t">{catalogueTitle}</div>
        <p className="sub">{catalogueSub}</p>
      </div>

      <div className="idx-tabs">
        <span className="l">Sort</span>
        <button data-on={sort === "alpha" ? "" : undefined} onClick={() => setSort("alpha")}>A–Z</button>
        <button data-on={sort === "films" ? "" : undefined} onClick={() => setSort("films")}>Most {unit}</button>
        <button data-on={sort === "new" ? "" : undefined} onClick={() => setSort("new")}>Newest</button>
        <span className="tot">{catalogue.length} {noun}</span>
      </div>

      <input className="idx-filter" placeholder={filterPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />

      {sort === "alpha" && (
        <div className="idx-azbar">
          {AZ.map((L) => (
            presentLetters.has(L)
              ? <a key={L} href={`#az-${L === "#" ? "0" : L}`}>{L}</a>
              : <a key={L} className="off">{L}</a>
          ))}
        </div>
      )}

      {filtered.length === 0 && <p className="idx-empty" style={{ display: "block" }}>{emptyText}</p>}

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

      {/* ---- just seeded (0-film readings) ---- */}
      {seeded.length > 0 && (
        <details className="idx-seeded">
          <summary><span className="chev">▸</span> {seedSummary} <span className="sub">({seeded.length})</span></summary>
          <div className="idx-seeded__body">
            <p className="idx-seeded__note">{seedNote}</p>
            <div className="idx-seedgrid">
              {seeded.map((it) => (
                <Link key={it.slug} href={`${rowBase}/${it.slug}`} className="idx-seed">
                  {it.title}<span className="z">0 {unit}</span>
                </Link>
              ))}
            </div>
          </div>
        </details>
      )}
    </>
  );
}
