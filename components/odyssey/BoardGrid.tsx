"use client";

/**
 * BoardGrid — the goban survey of the cinephile corpus: ~1,958 films tiled
 * 30 columns of year × rows of taste. Toggle Seen/Watchlist/Services to colour
 * matching films; filter by year or genre to thin the board. Hover for a bubble,
 * click for a side drawer. (The former "seen-centric" taste-spiral arrangement
 * was removed 2026-07-25 — /journey answers taste-centric "what next" legibly.)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { packBoard } from "@/lib/odyssey/board";

const IMG = "https://image.tmdb.org/t/p";
const NOW = 2025;
const EMPTY: ReadonlySet<string> = new Set();
const COLS = 30;

export default function BoardGrid() {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? EMPTY;

  const [map, setMap] = useState<OdyMap | null>(null);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [hlSeen, setHlSeen] = useState(false);
  const [hlWatch, setHlWatch] = useState(false);
  const [hlAvail, setHlAvail] = useState(false);
  const [yearMin, setYearMin] = useState(1900);
  const [yearMax, setYearMax] = useState(NOW);
  const [genre, setGenre] = useState<number | null>(null);
  // (The "seen-centric" taste-spiral arrangement was removed 2026-07-25 —
  //  owner judgment: a single-centroid golden-angle spiral with outward jitter
  //  reads as decorative noise, and /journey expresses seen-centric taste
  //  better. The board is the goban, full stop.)
  const [hover, setHover] = useState<{ s: OdyStation; x: number; y: number } | null>(null);
  const [open, setOpen] = useState<OdyStation | null>(null);
  const [boardW, setBoardW] = useState(1200);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/odyssey/map.v1.json").then((r) => r.json()).then(setMap).catch(() => {});
    try {
      if ((navigator.language || "").toLowerCase().startsWith("ko")) setCountry("KR");
      const cc = localStorage.getItem("ody.cc");
      if (cc === "KR" || cc === "US") setCountry(cc);
    } catch {}
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoardW(el.clientWidth));
    ro.observe(el);
    setBoardW(el.clientWidth);
    return () => ro.disconnect();
  }, [map]);

  const ensureAvail = useCallback((): Promise<OdyAvail | null> => {
    if (avail) return Promise.resolve(avail);
    return fetch("/odyssey/avail.v1.json").then((r) => (r.ok ? r.json() : null))
      .then((a: OdyAvail | null) => { if (a) setAvail(a); return a; }).catch(() => null);
  }, [avail]);

  useEffect(() => { if (hlAvail) void ensureAvail(); }, [hlAvail, ensureAvail]);
  useEffect(() => { try { localStorage.setItem("ody.cc", country); } catch {} }, [country]);

  const board = useMemo(() => (map ? packBoard(map.stations, COLS) : null), [map]);
  const byId = useMemo(() => new Map((map?.stations ?? []).map((s) => [s.s, s])), [map]);
  const availCC = useMemo(() => (avail ? avail[country] ?? {} : null), [avail, country]);

  // cell geometry
  const pw = Math.max(16, Math.min(34, Math.floor(boardW / COLS) - 2));
  const cellW = pw + 2;
  const rowH = pw * 1.5 + 2;

  // goban positions
  const layout = useMemo(() => {
    if (!board || !map) return null;
    const pos = new Map<string, { x: number; y: number }>();
    for (const c of board.cells) pos.set(c.s.s, { x: c.col * cellW + 1, y: c.row * rowH + 1 });
    return { pos, height: board.rows * rowH };
  }, [board, map, cellW, rowH]);

  const visible = useCallback((s: OdyStation) => {
    const y = s.y ?? 0;
    if (y < yearMin || y > yearMax) return false;
    if (genre != null && !(s.gi ?? []).includes(genre)) return false;
    return true;
  }, [yearMin, yearMax, genre]);

  const shownCount = useMemo(
    () => (board ? board.cells.filter((c) => visible(c.s)).length : 0),
    [board, visible],
  );

  const onGridMove = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (!slug) { setHover(null); return; }
    const s = byId.get(slug);
    if (!s) { setHover(null); return; }
    const wrap = wrapRef.current?.getBoundingClientRect();
    setHover({ s, x: e.clientX - (wrap?.left ?? 0), y: e.clientY - (wrap?.top ?? 0) });
  }, [byId]);
  const onGridClick = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (slug) { const s = byId.get(slug); if (s) { setOpen(s); setHover(null); } }
  }, [byId]);

  const anyHl = hlSeen || hlWatch || hlAvail;
  // only recede the rest when a highlight actually matches something
  const hasLit = useMemo(() => {
    if (!anyHl || !board) return false;
    return board.cells.some((c) => {
      const sl = c.s.s;
      return (hlSeen && seenSet.has(sl)) || (hlWatch && (uf?.get({ slug: sl }).watchlist ?? false))
        || (hlAvail && availCC && (availCC[sl]?.length ?? 0) > 0);
    });
  }, [anyHl, board, hlSeen, hlWatch, hlAvail, seenSet, uf, availCC]);

  if (!map || !board) return <div className="board-loading">Charting the board…</div>;
  const genres = map.genres ?? [];

  return (
    <div className="board-root">
      <div className="board-controls">
        <div className="board-hl">
          <span className="board-label">Highlight</span>
          <button className={`board-tog seen${hlSeen ? " on" : ""}`} onClick={() => setHlSeen((v) => !v)}>Seen</button>
          <button className={`board-tog watch${hlWatch ? " on" : ""}`} onClick={() => setHlWatch((v) => !v)}>Watchlist</button>
          <button className={`board-tog avail${hlAvail ? " on" : ""}`} onClick={() => setHlAvail((v) => !v)}>On my services</button>
          <select className="board-sel" value={country} onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")} aria-label="Country">
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </div>
        <div className="board-filters">
          <span className="board-label">Filter</span>
          <select className="board-sel" value={yearMin} onChange={(e) => setYearMin(Math.min(+e.target.value, yearMax))} aria-label="From year">
            {yearOpts().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="board-dash">–</span>
          <select className="board-sel" value={yearMax} onChange={(e) => setYearMax(Math.max(+e.target.value, yearMin))} aria-label="To year">
            {yearOpts().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="board-sel" value={genre ?? ""} onChange={(e) => setGenre(e.target.value === "" ? null : +e.target.value)} aria-label="Genre">
            <option value="">All genres</option>
            {genres.map((g, i) => <option key={g} value={i}>{g}</option>)}
          </select>
          <span className="board-count"><b>{shownCount.toLocaleString()}</b> / {board.cells.length.toLocaleString()} films</span>
        </div>
      </div>

      <div className="board-scroll">
        <div
          className={`board-stage${anyHl ? " has-hl" : ""}`}
          ref={wrapRef}
          style={{ height: layout ? layout.height : 400 }}
          onMouseMove={onGridMove}
          onMouseLeave={() => setHover(null)}
          onClick={onGridClick}
        >
          {board.cells.map((c) => {
            const s = c.s;
            const p = layout?.pos.get(s.s);
            if (!p) return null;
            const seen = seenSet.has(s.s);
            const watch = uf?.get({ slug: s.s }).watchlist ?? false;
            const availOn = availCC ? (availCC[s.s]?.length ?? 0) > 0 : false;
            const lit = (hlSeen && seen) || (hlWatch && watch) || (hlAvail && availOn);
            const ring = hlSeen && seen ? "r-seen" : hlWatch && watch ? "r-watch" : hlAvail && availOn ? "r-avail" : "";
            const cls = ["bcell", !visible(s) ? "off" : "", hasLit && !lit ? "dim" : "", ring].filter(Boolean).join(" ");
            return (
              <div key={s.s} className={cls} data-slug={s.s}
                style={{ width: pw, height: pw * 1.5, transform: `translate(${p.x}px, ${p.y}px)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/w92${s.p}`} alt="" loading="lazy" draggable={false} />
              </div>
            );
          })}
        </div>

        {hover ? (
          <div className="board-tip" style={{ left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth ?? 800) - 220), top: hover.y + 12 }}>
            <b>{hover.s.t}</b> <span>{hover.s.y ?? ""}</span>
            {hover.s.d ? <div className="d">{hover.s.d}</div> : null}
            <div className="m">
              {hover.s.v != null ? <span className="v">Value {hover.s.v}</span> : null}
              <span className="a">{"▲".repeat(hover.s.c)}</span>
              {seenSet.has(hover.s.s) ? <span className="s">✓ Seen</span> : null}
            </div>
            <div className="go">Click for details →</div>
          </div>
        ) : null}
      </div>

      <div className="board-legend">
        <span className="lg seen">Seen</span>
        <span className="lg watch">Watchlist</span>
        <span className="lg avail">On my services ({country})</span>
        <span className="lg-note">
          For a taste-driven next film, <a className="accent" href="/journey">The Journey</a> has the answer.
        </span>
      </div>

      {open ? <Drawer s={open} map={map} availCC={availCC} country={country} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function yearOpts() {
  const out: number[] = [];
  for (let y = 1900; y <= 2020; y += 10) out.push(y);
  out.push(NOW);
  return out;
}

function Drawer({ s, map, availCC, country, onClose }: {
  s: OdyStation; map: OdyMap; availCC: Record<string, string[]> | null; country: "KR" | "US"; onClose: () => void;
}) {
  const uf = useUserFilms();
  const st = uf?.get({ slug: s.s });
  const rating = st?.rating ?? 0;
  const lineById = useMemo(() => new Map(map.lines.map((l) => [l.id, l])), [map]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const genres = (s.gi ?? []).map((i) => map.genres?.[i]).filter(Boolean) as string[];
  return (
    <>
      <div className="board-scrim" onClick={onClose} />
      <aside className="board-drawer" role="dialog" aria-label={s.t}>
        <button className="bd-x" onClick={onClose} aria-label="Close">×</button>
        <div className="bd-head">
          {s.p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bd-poster" src={`${IMG}/w342${s.p}`} alt={`${s.t} poster`} />
          ) : null}
          <div className="bd-headmeta">
            <h3>{s.t}</h3>
            {s.tk ? <div className="bd-ko">{s.tk}</div> : null}
            <div className="bd-sub">{s.y ?? ""}{s.d ? ` · ${s.d}` : ""}</div>
            {s.pk ? <div className="bd-peak">★ Canon peak</div> : null}
          </div>
        </div>

        <div className="bd-scores">
          {s.v != null ? <div className="bd-score"><b>{s.v}</b><span>Value (TakeScore)</span></div> : null}
          <div className="bd-score"><b>{s.c}/5</b><span>Altitude · demand</span></div>
          {s.pr != null ? <div className="bd-score"><b>{Math.round(s.pr)}</b><span>Canon standing</span></div> : null}
        </div>

        {genres.length ? <div className="bd-genres">{genres.map((g) => <span key={g} className="bd-g">{g}</span>)}</div> : null}

        {s.ln?.length ? (
          <div className="bd-lines">
            <div className="bd-lbl">Lines</div>
            {s.ln.map((id) => {
              const l = lineById.get(id);
              if (!l) return null;
              return <a key={id} className="bd-line" href={`/odyssey?line=${id}`} style={{ ["--lc" as string]: l.color }}><span className="dot" />{l.name_en}</a>;
            })}
          </div>
        ) : null}

        {availCC?.[s.s]?.length ? (
          <div className="bd-avail"><div className="bd-lbl">Streaming ({country})</div>{availCC[s.s].join(" · ")}</div>
        ) : null}

        {uf ? (
          <div className="bd-actions">
            <button className={st?.seen ? "on" : ""} onClick={() => uf.toggleSeen({ slug: s.s })}>{st?.seen ? "✓ Seen" : "Seen"}</button>
            <button className={st?.watchlist ? "on" : ""} onClick={() => uf.toggleWatch({ slug: s.s })}>{st?.watchlist ? "＋ Watchlist" : "Watchlist"}</button>
            <div className="bd-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={rating >= n ? "on" : ""} aria-label={`${n} stars`} onClick={() => uf.rate({ slug: s.s }, rating === n ? 0 : n)}>★</button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="bd-links">
          <a href={`/film/${s.s}`}>Open full page →</a>
          <a href={`/whereto/${s.s}`}>Where to watch →</a>
        </div>
      </aside>
    </>
  );
}
