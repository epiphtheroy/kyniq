"use client";

/**
 * SentenceLexicon — the atlas-style "living index" rail beside a connection graph.
 * A column of boxes whose sentences keep changing (staggered, one cell at a time);
 * every entity named in a sentence is a button that RECENTERS the lexicon on that
 * entity ("클릭하면 그 엔티티 중심으로 글자들이 호출"). Data: /api/sentences/entity
 * (rule-based film_sentences layer — no AI-written text).
 *
 * Typography follows the Atlas hubs: uppercase micro-labels, hairline rules,
 * serif body, tabular index numbers. Auto-rotation pauses on hover and is
 * disabled under prefers-reduced-motion.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// type "sample" = view-flavored catalog sampler (key = comma-joined pattern list)
export type LexEnt = { type: string; key: string; key2?: string | null; label: string };

type Row = {
  id: number;
  pattern: string;
  sentence: string;
  film: { slug: string; title: string; year: number | null } | null;
  other: { slug: string; title: string; year: number | null } | null;
  node: { slug: string; title: string; kind: string } | null;
  figure: { slug: string; label: string } | null;
  theorist: { name: string; slug: string } | null;
  lineage: { slug: string; label: string } | null;
  framework: string | null;
};

const CELLS = 4;
const TAG: Record<string, string> = {
  A_affinity: "shared reading", B_bridge: "bridge", H_dense: "connection",
  C_reading: "reading", G_theorist_twin: "same lens", I_lens_twin: "same lens",
  D_award: "honor", E_rank: "rank", F_compare: "runtime",
  J_location: "location", L_trope: "trope", M_frame: "frame",
};

function pageHref(e: LexEnt): string | null {
  switch (e.type) {
    case "sample": return null;
    case "film": return `/film/${e.key}`;
    case "director": return `/director/${e.key}`;
    case "theorist": return `/theorist/${e.key}`;
    case "trope": return `/trope/${e.key}`;
    case "take": return `/take/${e.key}`;
    case "figure": return e.key2 ? `/film/${e.key}/figure/${e.key2}` : null;
    default: return null;
  }
}

// the recenterable entities a row names (besides its own anchor film)
function rowEnts(r: Row): LexEnt[] {
  const out: LexEnt[] = [];
  if (r.other) out.push({ type: "film", key: r.other.slug, label: r.other.year ? `${r.other.title} (${r.other.year})` : r.other.title });
  if (r.node) out.push({ type: r.node.kind === "figure_type" ? "trope" : "take", key: r.node.slug, label: r.node.title });
  if (r.theorist) out.push({ type: "theorist", key: r.theorist.slug, label: r.theorist.name });
  if (r.figure && r.film) out.push({ type: "figure", key: r.film.slug, key2: r.figure.slug, label: r.figure.label });
  return out.slice(0, 3);
}

export default function SentenceLexicon({ root, height = 460 }: { root: LexEnt; height?: number }) {
  const [cur, setCur] = useState<LexEnt>(root);
  const [trail, setTrail] = useState<LexEnt[]>([]);
  const [pool, setPool] = useState<Row[] | null>(null);
  const [ptrs, setPtrs] = useState<number[]>([0, 1, 2, 3]);
  const [reduced, setReduced] = useState(false);
  const turn = useRef(0);
  const nextIdx = useRef(CELLS);
  const paused = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd(); mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // root prop changed (parent recentered the graph) → adopt it, clear the trail
  useEffect(() => { setCur(root); setTrail([]); }, [root.type, root.key, root.key2]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch the pool for the current center
  useEffect(() => {
    let alive = true;
    setPool(null);
    const url = cur.type === "sample"
      ? `/api/sentences/sample?patterns=${encodeURIComponent(cur.key)}&n=18`
      : `/api/sentences/entity?type=${encodeURIComponent(cur.type)}&key=${encodeURIComponent(cur.key)}${cur.key2 ? `&key2=${encodeURIComponent(cur.key2)}` : ""}&limit=18`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setPool(Array.isArray(j.rows) ? j.rows : []);
        setPtrs([0, 1, 2, 3]); turn.current = 0; nextIdx.current = CELLS;
      })
      .catch(() => { if (alive) setPool([]); });
    return () => { alive = false; };
  }, [cur.type, cur.key, cur.key2]);

  // staggered rotation: one cell advances per tick to the next unshown sentence
  useEffect(() => {
    if (reduced || !pool || pool.length <= CELLS) return;
    const t = window.setInterval(() => {
      if (paused.current) return;
      const c = turn.current % CELLS; turn.current += 1;
      setPtrs((p) => {
        let cand = nextIdx.current % pool.length;
        while (p.includes(cand)) cand = (cand + 1) % pool.length;
        nextIdx.current = cand + 1;
        const n = [...p]; n[c] = cand; return n;
      });
    }, 3400);
    return () => window.clearInterval(t);
  }, [pool, reduced]);

  const go = useCallback((e: LexEnt) => {
    setTrail((t) => [...t, cur]);
    setCur(e);
  }, [cur]);
  const back = useCallback(() => {
    setTrail((t) => {
      if (!t.length) return t;
      setCur(t[t.length - 1]);
      return t.slice(0, -1);
    });
  }, []);
  const home = useCallback(() => { setCur(root); setTrail([]); }, [root]);

  // hide entirely when the ROOT itself has nothing (deeper empties show a hint instead)
  if (pool && pool.length === 0 && trail.length === 0 && cur.key === root.key && cur.type === root.type) return null;

  const href = pageHref(cur);
  const shown = pool && pool.length ? ptrs.map((i) => pool[i % pool.length]).filter(Boolean) : [];

  return (
    <aside
      className="lexi"
      style={{ minHeight: Math.min(height, 560) }}
      aria-label="Connection lexicon"
      onPointerEnter={() => { paused.current = true; }}
      onPointerLeave={() => { paused.current = false; }}
    >
      <div className="lexi-kicker">Embedding Fantasia</div>
      <div className="lexi-center">
        {trail.length > 0 ? <button className="lexi-nav" onClick={back} title="Back">‹</button> : null}
        <b className="lexi-title">{cur.label}</b>
        {href ? <a className="lexi-go" href={href} title="Open page">↗</a> : null}
        {trail.length > 0 ? <button className="lexi-nav" onClick={home} title="Back to start">⌂</button> : null}
      </div>

      {pool === null ? (
        <div className="lexi-empty">reading the graph…</div>
      ) : pool.length === 0 ? (
        <div className="lexi-empty">No entries for this node yet. <button className="lexi-nav" onClick={home}>⌂ back</button></div>
      ) : (
        <div className="lexi-cells">
          {shown.map((r, ci) => (
            <div className="lexi-cell" key={ci}>
              <div className="lexi-item" key={r.id}>
                <div className="lexi-meta">
                  <span className="lexi-no">{String((ptrs[ci] % pool.length) + 1).padStart(2, "0")}</span>
                  <span className="lexi-tag">{TAG[r.pattern] ?? "link"}</span>
                </div>
                <button
                  className="lexi-sent"
                  onClick={() => r.film && go({ type: "film", key: r.film.slug, label: r.film.year ? `${r.film.title} (${r.film.year})` : r.film.title })}
                  title={r.film ? `Recenter on ${r.film.title}` : undefined}
                >
                  {r.sentence}
                </button>
                <div className="lexi-ents">
                  {rowEnts(r).map((e, i) => (
                    <button key={i} className="lexi-ent" onClick={() => go(e)} title={`Recenter on ${e.label}`}>{e.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="lexi-foot">{pool?.length ? `${pool.length} entries · click any name to recenter · SQL-assembled, no AI text` : ""}</div>
    </aside>
  );
}
