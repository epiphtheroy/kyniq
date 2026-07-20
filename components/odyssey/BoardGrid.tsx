"use client";

/**
 * BoardGrid — a goban of the whole cinephile corpus. ~1,959 films tiled 40
 * columns (year) × up to 50 rows (taste classification), each a poster
 * thumbnail. Toggle 본 영화 / 볼 영화 / 내 서비스 and the matching films light
 * up; narrow the year range or a genre and the board thins to the survivors.
 * Hover a film for a quick bubble; open a side drawer for the full brief
 * without leaving the page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { packBoard } from "@/lib/odyssey/board";

const IMG = "https://image.tmdb.org/t/p";
const NOW = 2025;
const EMPTY: ReadonlySet<string> = new Set();

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
  const [hover, setHover] = useState<{ s: OdyStation; x: number; y: number } | null>(null);
  const [open, setOpen] = useState<OdyStation | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/odyssey/map.v1.json").then((r) => r.json()).then(setMap).catch(() => {});
    try {
      if ((navigator.language || "").toLowerCase().startsWith("ko")) setCountry("KR");
      const cc = localStorage.getItem("ody.cc");
      if (cc === "KR" || cc === "US") setCountry(cc);
    } catch {}
  }, []);

  const ensureAvail = useCallback((): Promise<OdyAvail | null> => {
    if (avail) return Promise.resolve(avail);
    return fetch("/odyssey/avail.v1.json").then((r) => (r.ok ? r.json() : null))
      .then((a: OdyAvail | null) => { if (a) setAvail(a); return a; }).catch(() => null);
  }, [avail]);

  useEffect(() => { if (hlAvail) void ensureAvail(); }, [hlAvail, ensureAvail]);
  useEffect(() => { try { localStorage.setItem("ody.cc", country); } catch {} }, [country]);

  const board = useMemo(() => (map ? packBoard(map.stations) : null), [map]);
  const byId = useMemo(() => new Map((map?.stations ?? []).map((s) => [s.s, s])), [map]);
  const availCC = useMemo(() => (avail ? avail[country] ?? {} : null), [avail, country]);

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

  // hover / click via delegation on the grid
  const onGridMove = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (!slug) { setHover(null); return; }
    const s = byId.get(slug);
    if (!s) { setHover(null); return; }
    const wrap = gridRef.current?.getBoundingClientRect();
    setHover({ s, x: e.clientX - (wrap?.left ?? 0), y: e.clientY - (wrap?.top ?? 0) });
  }, [byId]);
  const onGridClick = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = el?.dataset.slug;
    if (slug) { const s = byId.get(slug); if (s) { setOpen(s); setHover(null); } }
  }, [byId]);

  const anyHl = hlSeen || hlWatch || hlAvail;
  const containerCls = ["board-grid", anyHl ? "has-hl" : ""].filter(Boolean).join(" ");

  if (!map || !board) return <div className="board-loading">Charting {` `}the board…</div>;

  const genres = map.genres ?? [];

  return (
    <div className="board-root">
      <div className="board-controls">
        <div className="board-hl">
          <span className="board-label">색으로 보기</span>
          <button className={`board-tog seen${hlSeen ? " on" : ""}`} onClick={() => setHlSeen((v) => !v)}>본 영화</button>
          <button className={`board-tog watch${hlWatch ? " on" : ""}`} onClick={() => setHlWatch((v) => !v)}>볼 영화</button>
          <button className={`board-tog avail${hlAvail ? " on" : ""}`} onClick={() => setHlAvail((v) => !v)}>내 서비스</button>
          <select className="board-sel" value={country} onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")} aria-label="Country">
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </div>
        <div className="board-filters">
          <span className="board-label">거르기</span>
          <select className="board-sel" value={yearMin} onChange={(e) => setYearMin(Math.min(+e.target.value, yearMax))} aria-label="From year">
            {yearOpts().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="board-dash">–</span>
          <select className="board-sel" value={yearMax} onChange={(e) => setYearMax(Math.max(+e.target.value, yearMin))} aria-label="To year">
            {yearOpts().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="board-sel" value={genre ?? ""} onChange={(e) => setGenre(e.target.value === "" ? null : +e.target.value)} aria-label="Genre">
            <option value="">모든 장르</option>
            {genres.map((g, i) => <option key={g} value={i}>{g}</option>)}
          </select>
          <span className="board-count"><b>{shownCount.toLocaleString()}</b> / {board.cells.length.toLocaleString()}편</span>
        </div>
      </div>

      <div className="board-scroll">
        <div
          className={containerCls}
          ref={gridRef}
          style={{ gridTemplateColumns: `repeat(${board.cols}, 1fr)` }}
          onMouseMove={onGridMove}
          onMouseLeave={() => setHover(null)}
          onClick={onGridClick}
        >
          {board.cells.map((c) => {
            const s = c.s;
            const seen = seenSet.has(s.s);
            const watch = uf?.get({ slug: s.s }).watchlist ?? false;
            const availOn = availCC ? (availCC[s.s]?.length ?? 0) > 0 : false;
            const lit = (hlSeen && seen) || (hlWatch && watch) || (hlAvail && availOn);
            const ring = hlSeen && seen ? "r-seen" : hlWatch && watch ? "r-watch" : hlAvail && availOn ? "r-avail" : "";
            const cls = [
              "bcell",
              !visible(s) ? "off" : "",
              anyHl && !lit ? "dim" : "",
              ring,
            ].filter(Boolean).join(" ");
            return (
              <div key={s.s} className={cls} data-slug={s.s} style={{ gridColumn: c.col + 1, gridRow: c.row + 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/w92${s.p}`} alt="" loading="lazy" draggable={false} />
              </div>
            );
          })}
        </div>

        {hover ? (
          <div className="board-tip" style={{ left: Math.min(hover.x + 12, (gridRef.current?.clientWidth ?? 800) - 220), top: hover.y + 12 }}>
            <b>{hover.s.t}</b> <span>{hover.s.y ?? ""}</span>
            {hover.s.d ? <div className="d">{hover.s.d}</div> : null}
            <div className="m">
              {hover.s.v != null ? <span className="v">가치 {hover.s.v}</span> : null}
              <span className="a">{"▲".repeat(hover.s.c)}</span>
              {seenSet.has(hover.s.s) ? <span className="s">✓ 봤어요</span> : null}
            </div>
            <div className="go">클릭하면 자세히 보기 →</div>
          </div>
        ) : null}
      </div>

      <div className="board-legend">
        <span className="lg seen">본 영화</span>
        <span className="lg watch">볼 영화</span>
        <span className="lg avail">내 서비스({country})</span>
        <span className="lg-note">토글을 끄고 켜 조감하고, 거르기로 좁혀 보세요.</span>
      </div>

      {open ? (
        <Drawer s={open} map={map} availCC={availCC} country={country} onClose={() => setOpen(null)} />
      ) : null}
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
        <button className="bd-x" onClick={onClose} aria-label="닫기">×</button>
        <div className="bd-head">
          {s.p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bd-poster" src={`${IMG}/w342${s.p}`} alt={`${s.t} poster`} />
          ) : null}
          <div className="bd-headmeta">
            <h3>{s.t}</h3>
            {s.tk ? <div className="bd-ko">{s.tk}</div> : null}
            <div className="bd-sub">{s.y ?? ""}{s.d ? ` · ${s.d}` : ""}</div>
            {s.pk ? <div className="bd-peak">★ 정전 봉우리</div> : null}
          </div>
        </div>

        <div className="bd-scores">
          {s.v != null ? <div className="bd-score"><b>{s.v}</b><span>가치 (TakeScore)</span></div> : null}
          <div className="bd-score"><b>{s.c}/5</b><span>고도 · 요구도</span></div>
          {s.pr != null ? <div className="bd-score"><b>{Math.round(s.pr)}</b><span>정전 위상</span></div> : null}
        </div>

        {genres.length ? <div className="bd-genres">{genres.map((g) => <span key={g} className="bd-g">{g}</span>)}</div> : null}

        {s.ln?.length ? (
          <div className="bd-lines">
            <div className="bd-lbl">노선</div>
            {s.ln.map((id) => {
              const l = lineById.get(id);
              if (!l) return null;
              return <a key={id} className="bd-line" href={`/odyssey?line=${id}`} style={{ ["--lc" as string]: l.color }}><span className="dot" />{l.name_en}</a>;
            })}
          </div>
        ) : null}

        {availCC?.[s.s]?.length ? (
          <div className="bd-avail"><div className="bd-lbl">스트리밍 ({country})</div>{availCC[s.s].join(" · ")}</div>
        ) : null}

        {uf ? (
          <div className="bd-actions">
            <button className={st?.seen ? "on" : ""} onClick={() => uf.toggleSeen({ slug: s.s })}>{st?.seen ? "✓ 봤어요" : "봤어요"}</button>
            <button className={st?.watchlist ? "on" : ""} onClick={() => uf.toggleWatch({ slug: s.s })}>{st?.watchlist ? "＋ 볼래요" : "볼래요"}</button>
            <div className="bd-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={rating >= n ? "on" : ""} aria-label={`${n}점`} onClick={() => uf.rate({ slug: s.s }, rating === n ? 0 : n)}>★</button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="bd-links">
          <a href={`/film/${s.s}`}>전체 페이지 열기 →</a>
          <a href={`/whereto/${s.s}`}>어디서 볼까 →</a>
        </div>
      </aside>
    </>
  );
}
