"use client";
/**
 * NavigatorDrive — the web drive view (P3/P5). The familiar Google-Maps driving
 * shape: green turn card (next film) · a PANNABLE/ZOOMABLE map with standing
 * poster signposts · a collapsible peek sheet so the map owns the screen.
 * The route preference switches via a plain link (?pref=) — the server re-sorts
 * deterministically, no client math.
 */
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { DriveLoad } from "@/lib/navigator/load";
import type { RoutePref, RouteStop } from "@/lib/navigator/route";
import { turnReason, fmtRuntimeK, fmtHM } from "@/lib/navigator/route";

const POSTER = "https://image.tmdb.org/t/p/w185";
const po = (p: string | null) => (p ? `${POSTER}${p}` : "");

/* preset signpost slots along the road: near (bottom, large) → far (top, small) */
const SLOTS = [
  { top: 74, left: 71, w: 88 },
  { top: 60, left: 29, w: 64 },
  { top: 49, left: 70, w: 50 },
  { top: 40, left: 28, w: 40 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function NavigatorDrive({ load, pref }: { load: DriveLoad; pref: RoutePref }) {
  const { destination: dest, stats } = load;
  const route = load.routes[pref];
  const next = route.next;

  // pan/zoom — the map is navigable in its own right
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [open, setOpen] = useState(false); // sheet peek(false) / expanded(true)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  }, [view.tx, view.ty]);
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }));
  }, []);
  const onUp = useCallback(() => { drag.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    setView((v) => ({ ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 3) }));
  }, []);
  const zoom = (f: number) => setView((v) => ({ ...v, k: clamp(v.k * f, 0.55, 3) }));
  const fit = () => setView({ tx: 0, ty: 0, k: 1 });

  const share = useCallback(() => {
    const text = `🏁 Finished ${dest.label} — ${stats.total} films · ${fmtRuntimeK(stats.runtimeTraveled)}. Charted with the Metatake Navigator.`;
    const url = "https://metatake.net/room/navigator";
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) void nav.share({ title: "The Navigator", text, url }).catch(() => {});
    else void navigator.clipboard?.writeText(`${text} ${url}`);
  }, [dest.label, stats.total, stats.runtimeTraveled]);

  if (!next) {
    return (
      <div className="navd">
        <div className="arrived">
          <div style={{ fontSize: 38 }}>🏁</div>
          <div className="big">Arrived — {dest.label}</div>
          <div style={{ color: "var(--sub)", fontSize: 13 }}>{stats.total} films · {fmtRuntimeK(stats.runtimeTraveled)} total</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="ar-btn" onClick={share}>Share journey ↗</button>
            <Link href="/room/navigator" className="ar-btn ar-btn--2">New destination →</Link>
          </div>
        </div>
      </div>
    );
  }

  const then = route.stops[1]?.film ?? null;
  const near = route.stops.slice(0, 4);
  const finalStop = route.stops[route.stops.length - 1];
  const destIsNear = near.some((s) => s.film.slug === finalStop.film.slug);
  const progressPct = stats.total ? Math.round((stats.seenCount / stats.total) * 100) : 0;
  const travMin = stats.runtimeTraveled ?? 0;
  const remMin = stats.runtimeRemaining ?? 0;
  const donePct = travMin + remMin > 0 ? Math.round((travMin / (travMin + remMin)) * 100) : 0;
  const laneRent = next.availability === "rent";
  const roadName = dest.family === "director" ? `${dest.label} filmography` : dest.label;

  const sp = (stop: RouteStop, slot: { top: number; left: number; w: number }, isNow: boolean) => (
    <div key={stop.film.slug} className={`sp${isNow ? " now" : ""}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}>
      <img src={po(stop.film.poster_path)} alt="" style={{ width: slot.w, height: slot.w * 1.5 }} loading="lazy" draggable={false} />
      <span className="pole" /><span className="shadow" />
      {isNow ? <span className="cap">Now · {stop.film.title}</span> : slot.w >= 60 ? <span className="cap">{stop.film.title}</span> : null}
    </div>
  );

  return (
    <div className="navd">
      {/* turn card — the next film */}
      <div className="turn">
        <div className="row">
          <div className="mnv"><div className="ar">↰</div><div className="k">NEXT</div></div>
          <span className="po" style={{ backgroundImage: `url(${po(next.poster_path)})` }} />
          <div className="tx">
            <div className="tt">{next.title}</div>
            <div className="mt">{next.year ?? "?"} · {next.runtime ? `${next.runtime} min` : "—"} · {turnReason(next, dest, stats)}</div>
            {next.availability !== "none" ? (
              <span className={`lane${laneRent ? " rent" : ""}`}><span className="d" />{laneRent ? "Rent" : "Play now"}</span>
            ) : null}
          </div>
        </div>
        {then ? <div className="then"><span className="a">Then ↑</span> <b>{then.title}</b>{then.runtime ? ` · ${then.runtime} min` : ""}</div> : null}
      </div>

      {/* the map — pannable & zoomable */}
      <div className="map" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}>
        <div className="haze" />
        <div className="mapview" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` }}>
          <svg className="roadsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-4,70 L104,63" stroke="#CDC4AC" strokeWidth="7" fill="none" vectorEffect="non-scaling-stroke" opacity=".9" />
            <path d="M-4,48 L104,44" stroke="#CFC6AE" strokeWidth="5" fill="none" vectorEffect="non-scaling-stroke" opacity=".8" />
            <path d="M30,101 L41,60 C43,50 45,44 49,40 L49.4,20 L50.6,20 L51,40 C55,44 57,50 59,60 L70,101 Z" fill="var(--road)" stroke="#C7BEA6" strokeWidth=".5" />
            <path d="M30,101 L37,80 L63,80 L70,101 Z" fill="#CFC6AD" opacity=".55" />
            <path d="M50,101 L50,60 C50,50 49.6,44 49.6,40 L50,20" fill="none" stroke="#fff" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <path d="M50,101 L50,60 C50,50 49.6,44 49.6,40 L50,20" fill="none" stroke="var(--blue)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <path d="M50,96 L50,60 C50,50 49.6,44 49.6,40 L50,24" fill="none" stroke="#ffffffbb" strokeWidth="1.2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="street cur" style={{ left: "34%", top: "88%" }}>{roadName}</div>
          <div className="street" style={{ left: "20%", top: "68%" }}>Noir lineage →</div>
          <div className="street" style={{ left: "80%", top: "44%" }}>Formalist Blvd</div>
          {near.map((stop, i) => sp(stop, SLOTS[i], i === 0))}
          {!destIsNear ? (
            <div className="sp dest" style={{ left: "50%", top: "28%" }}>
              <span className="flag">🏁</span>
              <img src={po(finalStop.film.poster_path)} alt="" style={{ width: 28, height: 42 }} loading="lazy" draggable={false} />
              <span className="shadow" /><span className="cap">{finalStop.film.title}</span>
            </div>
          ) : null}
          <div className="me"><div className="chev" /><div className="dot" /><div className="back">↓ {stats.seenCount} behind you</div></div>
        </div>
        {/* map controls (outside the transformed layer) */}
        <div className="mapctl">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>＋</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)}>－</button>
          <button type="button" aria-label="Reset view" onClick={fit}>◎</button>
        </div>
      </div>

      {/* peek sheet — short by default so the map owns the screen; tap to expand */}
      <div className={`sheet${open ? " open" : ""}`}>
        <button type="button" className="grip" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)} />
        <div className="peek" onClick={() => setOpen((o) => !o)}>
          <div className="headline">
            <span className="dur">{fmtRuntimeK(stats.runtimeRemaining)}</span>
            <span className="films">{stats.remaining} films</span>
            <span className="soft">{open ? "time remaining" : "tap for detail"}{stats.etaWeeks ? ` · ~${stats.etaWeeks} wk` : ""}</span>
          </div>
          {!open ? <div className="peekbar"><span style={{ width: `${progressPct}%` }} /></div> : null}
        </div>
        {open ? (
          <>
            <div className="meter">
              <div className="track"><span className="done" style={{ width: `${donePct}%` }} /><span className="knob" style={{ left: `${donePct}%` }} /></div>
              <div className="ends">
                <span className="l"><span className="cap">Traveled</span><b>{stats.seenCount} films · {fmtHM(stats.runtimeTraveled)}</b></span>
                <span className="r"><span className="cap">Remaining</span><b>{stats.remaining} films · {fmtHM(stats.runtimeRemaining)}</b></span>
              </div>
            </div>
            <div className="prefs">
              {(["fewest", "fastest", "no_tolls"] as RoutePref[]).map((p) => (
                <Link key={p} className={p === pref ? "on" : ""} href={`?pref=${p}`} scroll={false}>
                  {p === "fewest" ? "Fewest" : p === "fastest" ? "Fastest" : "No tolls"}
                </Link>
              ))}
            </div>
            {/* the full remaining route — every film left, in drive order (Google-Maps "steps") */}
            <div className="steps">
              <div className="steps-h">Remaining route · {stats.remaining} films</div>
              <div className="steps-row">
                {route.stops.map((s, i) => (
                  <Link key={s.film.slug} href={`/film/${s.film.slug}`} className={`step${i === 0 ? " now" : ""}`} title={s.film.title}>
                    <span className="step-po" style={{ backgroundImage: `url(${po(s.film.poster_path)})` }}>
                      <span className="step-n">{i + 1}</span>
                    </span>
                    <span className="step-t">{s.film.title}</span>
                    <span className="step-m">{s.film.runtime ? `${s.film.runtime}m` : "—"}{s.toll ? " · toll" : s.film.availability === "sub" ? " · ▶" : ""}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="fnote">{progressPct}% complete · {dest.label} · position from your ledger · <Link href="/room/navigator">Change destination</Link></div>
          </>
        ) : null}
      </div>
    </div>
  );
}
