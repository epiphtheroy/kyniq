"use client";

/**
 * BoardGrid — the goban survey of the cinephile corpus, tiled as a dense,
 * width-filling grid ranked by TakeScore. A scale selector (100 · 500 · 1000 ·
 * 2000/All) shows the top-N films by TakeScore, packed row-major so the board
 * always fills the width with no dead gaps. Columns and poster size are computed
 * from the container width and the chosen scale, so posters land comfortably
 * large at every breakpoint. A three-mode Seen filter (All · Only seen · Exclude
 * seen) actually thins the tiles; the Seen/Watchlist/On-my-services toggles tint
 * matching tiles. Hover for a bubble, click for a side drawer.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useUserFilms } from "@/components/UserFilmsProvider";
import { useConversion } from "@/components/conversion/ConversionProvider";
import { mtEvent } from "@/components/mtTrack";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";

const IMG = "https://image.tmdb.org/t/p";
const NOW = 2025;
const EMPTY: ReadonlySet<string> = new Set();

type Scale = 100 | 500 | 1000 | 2000;
type SeenMode = "all" | "only" | "exclude";
type SortMode = "score" | "year";
// Imperative handle for the hover bubble — the grid calls these on pointer moves
// instead of lifting cursor position into state (which would re-render every tile).
type TipHandle = { show: (s: OdyStation, x: number, y: number, seen: boolean) => void; hide: () => void };

const SCALES: Scale[] = [100, 500, 1000, 2000];
// Target poster width (px) per scale — fewer films → bigger posters. Columns are
// derived from the live container width so the last column reaches the edge.
const TARGET_W: Record<Scale, number> = { 100: 132, 500: 92, 1000: 76, 2000: 62 };
const GAP = 4;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
// Inline "link button": an in-context AuthSheet trigger that reads as a text link.
// Board CSS is out of scope here, so the link affordance is styled inline.
const LINK_BTN: React.CSSProperties = {
  background: "none", border: 0, padding: 0, margin: 0, font: "inherit", cursor: "pointer",
  textDecoration: "underline", textUnderlineOffset: "2px", fontWeight: 700,
};

export default function BoardGrid() {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? EMPTY;
  // Nullable by design: if the ConversionProvider isn't mounted, we fall back to
  // the plain /login link so the readout is never a dead end.
  const conv = useConversion();

  const [map, setMap] = useState<OdyMap | null>(null);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [scale, setScale] = useState<Scale>(500);
  const [seenMode, setSeenMode] = useState<SeenMode>("all");
  const [sort, setSort] = useState<SortMode>("score");
  const [hlSeen, setHlSeen] = useState(false);
  const [hlWatch, setHlWatch] = useState(false);
  const [hlAvail, setHlAvail] = useState(false);
  const [yearMin, setYearMin] = useState(1900);
  const [yearMax, setYearMax] = useState(NOW);
  const [genre, setGenre] = useState<number | null>(null);
  const [open, setOpen] = useState<OdyStation | null>(null);
  const [boardW, setBoardW] = useState(1200);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  // The hover bubble is driven imperatively (see BoardTip): pointer moves write
  // straight to its DOM node, so panning the grid never re-renders the tiles.
  const tipRef = useRef<TipHandle | null>(null);

  useEffect(() => {
    fetch("/odyssey/map.v1.json").then((r) => r.json()).then(setMap).catch(() => {});
    try {
      if ((navigator.language || "").toLowerCase().startsWith("ko")) setCountry("KR");
      const cc = localStorage.getItem("ody.cc");
      if (cc === "KR" || cc === "US") setCountry(cc);
      const sc = Number(localStorage.getItem("board.scale"));
      if (SCALES.includes(sc as Scale)) setScale(sc as Scale);
      const sm = localStorage.getItem("board.seen");
      if (sm === "all" || sm === "only" || sm === "exclude") setSeenMode(sm);
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
  useEffect(() => { try { localStorage.setItem("board.scale", String(scale)); } catch {} }, [scale]);
  useEffect(() => { try { localStorage.setItem("board.seen", seenMode); } catch {} }, [seenMode]);

  // A signed-out visitor sees an in-context join invitation in place of the seen
  // count; count that it surfaced (once per page — mtEvent dedupes on path|name).
  useEffect(() => {
    if ((uf?.ready ?? false) && !uf?.uid) mtEvent("nudge_shown:board");
  }, [uf?.ready, uf?.uid]);

  const byId = useMemo(() => new Map((map?.stations ?? []).map((s) => [s.s, s])), [map]);
  const availCC = useMemo(() => (avail ? avail[country] ?? {} : null), [avail, country]);

  // Whole corpus ranked by TakeScore (v), descending — the spine of every view.
  const ranked = useMemo(() => {
    const films = (map?.stations ?? []).filter((s) => s.v != null && s.p);
    films.sort((a, b) => (b.v! - a.v!) || a.s.localeCompare(b.s));
    return films;
  }, [map]);

  // The chosen scale = the top-N films by TakeScore.
  const pool = useMemo(() => ranked.slice(0, scale), [ranked, scale]);

  // Display order within the pool: TakeScore (default) or chronological (era).
  const ordered = useMemo(() => {
    if (sort === "year") return pool.slice().sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (b.v! - a.v!));
    return pool;
  }, [pool, sort]);

  const passFilter = useCallback((s: OdyStation) => {
    const y = s.y ?? 0;
    if (y < yearMin || y > yearMax) return false;
    if (genre != null && !(s.gi ?? []).includes(genre)) return false;
    return true;
  }, [yearMin, yearMax, genre]);

  // The survey set = pool ∩ year ∩ genre. This is the "board" the seen counter
  // measures against; the seen-mode below only changes which tiles render.
  const survey = useMemo(() => ordered.filter(passFilter), [ordered, passFilter]);

  const displayList = useMemo(() => {
    if (seenMode === "only") return survey.filter((s) => seenSet.has(s.s));
    if (seenMode === "exclude") return survey.filter((s) => !seenSet.has(s.s));
    return survey;
  }, [survey, seenMode, seenSet]);

  const seenInSurvey = useMemo(
    () => survey.reduce((n, s) => n + (seenSet.has(s.s) ? 1 : 0), 0),
    [survey, seenSet],
  );

  // Columns + poster size from the live width and the chosen scale.
  const cols = useMemo(() => {
    const t = TARGET_W[scale];
    return clamp(Math.round((boardW + GAP) / (t + GAP)), 4, 40);
  }, [boardW, scale]);
  const posterW = Math.max(1, Math.floor((boardW - GAP * (cols - 1)) / cols));
  // Tiles are small, but hovering scales a poster 2.2× (board.css), so the source
  // must cover the zoomed size, not the tile: floor at w185, w342 for the big scale.
  const imgSz = posterW <= 110 ? "w185" : "w342";

  const onGridMove = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (!slug) { tipRef.current?.hide(); return; }
    const s = byId.get(slug);
    if (!s) { tipRef.current?.hide(); return; }
    const wrap = wrapRef.current?.getBoundingClientRect();
    // Imperative: no setState here, so the tile list never re-renders on move.
    tipRef.current?.show(s, e.clientX - (wrap?.left ?? 0), e.clientY - (wrap?.top ?? 0), seenSet.has(s.s));
  }, [byId, seenSet]);
  const onGridClick = useCallback((e: React.MouseEvent) => {
    // let modified clicks (new tab / new window) follow the tile's real href
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as React.MouseEvent).button === 1) return;
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (slug) { const s = byId.get(slug); if (s) { e.preventDefault(); setOpen(s); tipRef.current?.hide(); } }
  }, [byId]);

  const anyHl = hlSeen || hlWatch || hlAvail;
  // only recede the rest when a highlight actually matches something on the board
  const hasLit = useMemo(() => {
    if (!anyHl) return false;
    return displayList.some((s) => {
      const sl = s.s;
      return (hlSeen && seenSet.has(sl)) || (hlWatch && (uf?.get({ slug: sl }).watchlist ?? false))
        || (hlAvail && availCC && (availCC[sl]?.length ?? 0) > 0);
    });
  }, [anyHl, displayList, hlSeen, hlWatch, hlAvail, seenSet, uf, availCC]);

  if (!map) return <div className="board-loading">Charting the board…</div>;
  const genres = map.genres ?? [];
  const ready = uf?.ready ?? false;
  const signedIn = !!uf?.uid;
  // Personalized highlights need a resolved, signed-in library; while auth + the
  // user_movies paging is still resolving we don't yet know, so treat as pending.
  const noLibrary = ready && !signedIn;

  return (
    <div className="board-root">
      <div className="board-controls">
        <div className="board-group">
          <span className="board-label">Films</span>
          <div className="board-seg" role="group" aria-label="How many films">
            {SCALES.map((n) => (
              <button key={n} className={scale === n ? "on" : ""} aria-pressed={scale === n}
                onClick={() => setScale(n)}>
                {n === 2000 ? "All" : n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        <div className="board-group">
          <span className="board-label">Show</span>
          <div className="board-seg" role="group" aria-label="Seen filter">
            <button className={seenMode === "all" ? "on" : ""} aria-pressed={seenMode === "all"} onClick={() => setSeenMode("all")}>All</button>
            <button className={seenMode === "only" ? "on" : ""} aria-pressed={seenMode === "only"} onClick={() => setSeenMode("only")}>Only seen</button>
            <button className={seenMode === "exclude" ? "on" : ""} aria-pressed={seenMode === "exclude"} onClick={() => setSeenMode("exclude")}>Exclude seen</button>
          </div>
        </div>
        <div className="board-group">
          <span className="board-label">Order</span>
          <div className="board-seg" role="group" aria-label="Sort order">
            <button className={sort === "score" ? "on" : ""} aria-pressed={sort === "score"} onClick={() => setSort("score")}>TakeScore</button>
            <button className={sort === "year" ? "on" : ""} aria-pressed={sort === "year"} onClick={() => setSort("year")}>Year</button>
          </div>
        </div>
      </div>

      <div className="board-readout">
        <div className="board-seencount">
          {!ready ? (
            <>Counting what you've seen…</>
          ) : signedIn ? (
            <>You've seen <b>{seenInSurvey.toLocaleString()}</b> of <b>{survey.length.toLocaleString()}</b> on this board</>
          ) : conv ? (
            <>
              <button type="button" className="accent" style={LINK_BTN}
                onClick={() => conv.openAuth({ ctx: { kind: "claim", surface: "board" } })}>
                Sign in
              </button>{" "}
              to see how many of these <b>{survey.length.toLocaleString()}</b> you've watched — your canon lights up.
            </>
          ) : (
            <><Link className="accent" href="/login?next=/board">Sign in</Link> to see how many of these <b>{survey.length.toLocaleString()}</b> you've watched</>
          )}
        </div>
        <div className="board-hl">
          <span className="board-label">Highlight</span>
          <button className={`board-tog seen${hlSeen ? " on" : ""}`} onClick={() => setHlSeen((v) => !v)}
            disabled={noLibrary} title={noLibrary ? "Sign in to highlight what you've seen" : undefined}>Seen</button>
          <button className={`board-tog watch${hlWatch ? " on" : ""}`} onClick={() => setHlWatch((v) => !v)}
            disabled={noLibrary} title={noLibrary ? "Sign in to highlight your watchlist" : undefined}>Watchlist</button>
          <button className={`board-tog avail${hlAvail ? " on" : ""}`} onClick={() => setHlAvail((v) => !v)}>On my services</button>
          <select className="board-sel" value={country} onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")} aria-label="Country">
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </div>
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
        <span className="board-count"><b>{displayList.length.toLocaleString()}</b> tiles shown</span>
      </div>

      <div className="board-scroll">
        <div
          className={`board-stage${anyHl ? " has-hl" : ""}`}
          ref={wrapRef}
          style={{ ["--cols" as string]: cols, ["--gap" as string]: `${GAP}px` }}
          onMouseMove={onGridMove}
          onMouseLeave={() => tipRef.current?.hide()}
          onClick={onGridClick}
        >
          {displayList.map((s) => {
            const seen = seenSet.has(s.s);
            const watch = uf?.get({ slug: s.s }).watchlist ?? false;
            const availOn = availCC ? (availCC[s.s]?.length ?? 0) > 0 : false;
            const lit = (hlSeen && seen) || (hlWatch && watch) || (hlAvail && availOn);
            const ring = hlSeen && seen ? "r-seen" : hlWatch && watch ? "r-watch" : hlAvail && availOn ? "r-avail" : "";
            const cls = ["bcell", hasLit && !lit ? "dim" : "", ring].filter(Boolean).join(" ");
            return (
              // real link → keyboard-focusable + screen-reader named ("link, Title (year)");
              // a plain click or Enter opens the in-page drawer (onGridClick preventDefault),
              // ⌘/ctrl/shift-click follows the href to the film page in a new tab.
              <a key={s.s} className={cls} data-slug={s.s} href={`/film/${s.s}`}
                aria-label={`${s.t}${s.y ? ` (${s.y})` : ""}${seen ? " · seen" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${imgSz}${s.p}`} alt="" loading="lazy" draggable={false} />
              </a>
            );
          })}
          {displayList.length === 0 ? (
            <div className="board-empty">No films match these filters. Widen the year range, clear the genre, or switch the Show filter back to All.</div>
          ) : null}
        </div>

        <BoardTip ref={tipRef} wrapRef={wrapRef} />
      </div>

      <div className="board-legend">
        <span className="lg seen">Seen</span>
        <span className="lg watch">Watchlist</span>
        <span className="lg avail">On my services ({country})</span>
        <span className="lg-note">
          For a taste-driven next film, open <a className="accent" href="/journey">For You</a>.
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

// The hover bubble lives here, isolated from the grid. Its node is always mounted;
// show()/hide() write position straight to the DOM (no re-render at all), and the
// content only re-renders when the pointer crosses into a different tile — so
// moving across up to 2,000 tiles never reconciles the tile list.
const BoardTip = forwardRef<TipHandle, { wrapRef: React.RefObject<HTMLDivElement | null> }>(
  function BoardTip({ wrapRef }, ref) {
    const elRef = useRef<HTMLDivElement | null>(null);
    const curSlug = useRef<string | null>(null);
    const [data, setData] = useState<{ s: OdyStation; seen: boolean } | null>(null);

    useImperativeHandle(ref, () => ({
      show(s, x, y, seen) {
        const el = elRef.current;
        if (el) {
          const w = wrapRef.current?.clientWidth ?? 800;
          el.style.left = `${Math.min(x + 12, w - 220)}px`;
          el.style.top = `${y + 12}px`;
          el.style.display = "block";
        }
        // Content only changes when the hovered film changes — not on every pixel.
        if (curSlug.current !== s.s) { curSlug.current = s.s; setData({ s, seen }); }
      },
      hide() {
        curSlug.current = null;
        if (elRef.current) elRef.current.style.display = "none";
        setData(null);
      },
    }), [wrapRef]);

    return (
      <div className="board-tip" ref={elRef} style={{ display: "none" }} aria-hidden="true">
        {data ? (
          <>
            <b>{data.s.t}</b> <span>{data.s.y ?? ""}</span>
            {data.s.d ? <div className="d">{data.s.d}</div> : null}
            <div className="m">
              {data.s.v != null ? <span className="v">TakeScore {data.s.v}</span> : null}
              <span className="a">{"▲".repeat(data.s.c)}</span>
              {data.seen ? <span className="s">✓ Seen</span> : null}
            </div>
            <div className="go">Click for details →</div>
          </>
        ) : null}
      </div>
    );
  },
);

function Drawer({ s, map, availCC, country, onClose }: {
  s: OdyStation; map: OdyMap; availCC: Record<string, string[]> | null; country: "KR" | "US"; onClose: () => void;
}) {
  const uf = useUserFilms();
  const st = uf?.get({ slug: s.s });
  const rating = st?.rating ?? 0;
  const lineById = useMemo(() => new Map(map.lines.map((l) => [l.id, l])), [map]);
  const panelRef = useRef<HTMLElement | null>(null);

  // On open, remember what had focus, move focus into the panel, and restore it on
  // close so keyboard/SR users return to the tile they came from.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>(".bd-x")?.focus();
    return () => prev?.focus?.();
  }, []);

  // Escape closes; Tab is trapped within the panel so focus can't fall behind the scrim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const f = Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null);
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const genres = (s.gi ?? []).map((i) => map.genres?.[i]).filter(Boolean) as string[];
  return (
    <>
      <div className="board-scrim" onClick={onClose} />
      <aside className="board-drawer" role="dialog" aria-modal="true" aria-label={s.t} ref={panelRef}>
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
          {s.v != null ? <div className="bd-score"><b>{s.v}</b><span>TakeScore</span></div> : null}
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
          <div className="bd-avail"><div className="bd-lbl">On my services ({country})</div>{availCC[s.s].join(" · ")}</div>
        ) : null}

        {uf ? (
          <div className="bd-actions">
            <button className={st?.seen ? "on" : ""} onClick={() => uf.toggleSeen({ slug: s.s })}>{st?.seen ? "✓ Seen" : "Seen"}</button>
            <button className={st?.watchlist ? "on" : ""} onClick={() => uf.toggleWatch({ slug: s.s })}>{st?.watchlist ? "✓ On watchlist" : "＋ Watchlist"}</button>
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
