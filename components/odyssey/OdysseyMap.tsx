"use client";

/**
 * OdysseyMap — the interactive cinephile metro map (/odyssey).
 *
 * Renders the static map artifact (public/odyssey/map.v1.json) as a pannable,
 * zoomable SVG. The artifact is identical for everyone; personalization
 * (seen films via UserFilmsProvider, streaming availability by country) is a
 * pure client-side overlay, in keeping with the no-server-HTML-personalization
 * rule. Pan/zoom writes straight to the <g> transform via refs — React state
 * only tracks the zoom bucket (z0/z1/z2 label LOD) and UI selections.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import { elbowPath, type OdyAvail, type OdyMap, type OdyStation } from "@/lib/odyssey/types";
import { MODES, propose, type ModeKey, type Proposal } from "@/lib/odyssey/modes";

const EMPTY_SET: ReadonlySet<string> = new Set();
const TMDB_IMG = "https://image.tmdb.org/t/p/w154";

type View = { k: number; tx: number; ty: number };

function zoomBucket(k: number): 0 | 1 | 2 {
  return k < 0.55 ? 0 : k < 1.2 ? 1 : 2;
}

export default function OdysseyMap() {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? EMPTY_SET;

  const [data, setData] = useState<OdyMap | null>(null);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [showSeen, setShowSeen] = useState(true);
  const [showAvail, setShowAvail] = useState(false);
  const [zb, setZb] = useState<0 | 1 | 2>(0);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [solo, setSolo] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [prop, setProp] = useState<(Proposal & { mode: ModeKey }) | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const view = useRef<View>({ k: 0.4, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchBase = useRef<{ d: number; k: number } | null>(null);
  const moved = useRef(0);
  const flyRaf = useRef(0);

  useEffect(() => {
    fetch("/odyssey/map.v1.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
    try {
      if ((navigator.language || "").toLowerCase().startsWith("ko")) setCountry("KR");
      const cc = localStorage.getItem("ody.cc");
      if (cc === "KR" || cc === "US") setCountry(cc);
      if (localStorage.getItem("ody.avail") === "1") setShowAvail(true);
    } catch {}
  }, []);

  const ensureAvail = useCallback(() => {
    if (avail) return Promise.resolve(avail);
    return fetch("/odyssey/avail.v1.json")
      .then((r) => r.json())
      .then((a: OdyAvail) => {
        setAvail(a);
        return a;
      });
  }, [avail]);

  useEffect(() => {
    if (showAvail) void ensureAvail();
    try {
      localStorage.setItem("ody.avail", showAvail ? "1" : "0");
      localStorage.setItem("ody.cc", country);
    } catch {}
  }, [showAvail, country, ensureAvail]);

  const S = useMemo(() => new Map((data?.stations ?? []).map((s) => [s.s, s])), [data]);
  const availCC = useMemo(
    () => (avail ? avail[country] ?? {} : null),
    [avail, country],
  );

  // ---------------------------------------------------------------- camera
  const applyView = useCallback(() => {
    const { k, tx, ty } = view.current;
    gRef.current?.setAttribute("transform", `translate(${tx} ${ty}) scale(${k})`);
    setZb(zoomBucket(k));
  }, []);

  const clampView = useCallback(() => {
    if (!data || !wrapRef.current) return;
    const v = view.current;
    const cw = wrapRef.current.clientWidth;
    const ch = wrapRef.current.clientHeight;
    v.k = Math.min(3.2, Math.max(0.22, v.k));
    v.tx = Math.min(cw * 0.7, Math.max(cw * 0.3 - data.w * v.k, v.tx));
    v.ty = Math.min(ch * 0.7, Math.max(ch * 0.3 - data.h * v.k, v.ty));
  }, [data]);

  useEffect(() => {
    if (!data || !wrapRef.current) return;
    const cw = wrapRef.current.clientWidth;
    const k = Math.min(1, Math.max(0.24, cw / data.w));
    view.current = { k, tx: 0, ty: 0 };
    applyView();
  }, [data, applyView]);

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const v = view.current;
      const k2 = Math.min(3.2, Math.max(0.22, v.k * factor));
      v.tx = cx - ((cx - v.tx) / v.k) * k2;
      v.ty = cy - ((cy - v.ty) / v.k) * k2;
      v.k = k2;
      clampView();
      applyView();
    },
    [applyView, clampView],
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, data]);

  const fly = useCallback(
    (x: number, y: number, k: number) => {
      const el = wrapRef.current;
      if (!el) return;
      cancelAnimationFrame(flyRaf.current);
      const from = { ...view.current };
      const to: View = {
        k,
        tx: el.clientWidth / 2 - x * k,
        ty: el.clientHeight / 2 - y * k,
      };
      const reduce =
        typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        view.current = to;
        clampView();
        applyView();
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 550);
        const e = 1 - Math.pow(1 - p, 3);
        view.current = {
          k: from.k + (to.k - from.k) * e,
          tx: from.tx + (to.tx - from.tx) * e,
          ty: from.ty + (to.ty - from.ty) * e,
        };
        applyView();
        if (p < 1) flyRaf.current = requestAnimationFrame(step);
      };
      flyRaf.current = requestAnimationFrame(step);
    },
    [applyView, clampView],
  );

  // ---------------------------------------------------------------- pointers
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchBase.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.current.k };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchBase.current && svgRef.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = svgRef.current.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - r.left;
      const cy = (a.y + b.y) / 2 - r.top;
      const target = (pinchBase.current.k * d) / Math.max(1, pinchBase.current.d);
      zoomAt(cx, cy, target / view.current.k);
      return;
    }
    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      view.current.tx += dx;
      view.current.ty += dy;
      clampView();
      applyView();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchBase.current = null;
  };

  // ---------------------------------------------------------------- actions
  const selectStation = useCallback((slug: string | null) => {
    setSel(slug);
  }, []);

  const runMode = useCallback(
    async (mode: ModeKey) => {
      if (!data) return;
      let a = availCC;
      if (mode === "tonight" && !a) {
        const full = await ensureAvail();
        a = full[country] ?? {};
      }
      const p = propose(mode, { map: data, seen: seenSet, avail: a });
      if (!p) {
        setProp({ mode, slug: "", reason: "Nothing left to propose here — you have ridden this one dry.", from: undefined });
        return;
      }
      setProp({ ...p, mode });
      setSel(p.slug);
      if (p.line) setSolo(p.line);
      const st = S.get(p.slug);
      if (st) fly(st.x, st.yy, Math.max(1.3, view.current.k));
    },
    [data, availCC, ensureAvail, country, seenSet, S, fly],
  );

  const focusLine = useCallback(
    (id: string | null) => {
      setSolo(id);
      if (!id || !data || !wrapRef.current) return;
      const line = data.lines.find((l) => l.id === id);
      if (!line) return;
      const pts = line.stations.map((s) => S.get(s)).filter(Boolean) as OdyStation[];
      if (!pts.length) return;
      const x1 = Math.min(...pts.map((p) => p.x));
      const x2 = Math.max(...pts.map((p) => p.x));
      const y1 = Math.min(...pts.map((p) => p.yy));
      const y2 = Math.max(...pts.map((p) => p.yy));
      const cw = wrapRef.current.clientWidth;
      const ch = wrapRef.current.clientHeight;
      const k = Math.min(2.2, Math.max(0.24, Math.min(cw / (x2 - x1 + 240), ch / (y2 - y1 + 240))));
      fly((x1 + x2) / 2, (y1 + y2) / 2, k);
    },
    [data, S, fly],
  );

  useEffect(() => {
    if (!data) return;
    try {
      const q = new URLSearchParams(window.location.search).get("line");
      if (q && data.lines.some((l) => l.id === q)) focusLine(q);
    } catch {}
    // run once when the artifact arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---------------------------------------------------------------- render
  const lineCss = useMemo(() => {
    if (!data) return "";
    return data.lines
      .map(
        (l) =>
          `.ody-svg.on-${l.id} path.ody-line.ln-${l.id}{opacity:1;stroke-width:7px}` +
          `.ody-svg.on-${l.id} g.st.ln-${l.id}{opacity:1}`,
      )
      .join("\n");
  }, [data]);

  const stationLayer = useMemo(() => {
    if (!data) return null;
    return data.stations.map((st) => {
      const cls = [
        "st",
        st.ln?.length ? "onl" : "loc",
        ...(st.ln ?? []).map((l) => `ln-${l}`),
        st.tf ? "tf" : "",
        st.pk ? "pk" : "",
        seenSet.has(st.s) ? "seen" : "",
        showAvail && availCC && availCC[st.s]?.length ? "av" : "",
        sel === st.s ? "is-sel" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return (
        <g
          key={st.s}
          className={cls}
          onClick={(e) => {
            if (moved.current > 6) return;
            e.stopPropagation();
            selectStation(st.s);
          }}
        >
          {showAvail && availCC && availCC[st.s]?.length ? (
            <circle className="avr" cx={st.x} cy={st.yy} r={st.tf ? 10 : 8} />
          ) : null}
          <circle className="c" cx={st.x} cy={st.yy} r={st.tf ? 6 : st.ln?.length ? 4.4 : 2.4} />
          <text
            className="lbl"
            x={st.x}
            y={st.yy + ((st.s.charCodeAt(0) + st.s.length) % 2 ? 22 : -10)}
            textAnchor="middle"
          >
            {st.t}
          </text>
        </g>
      );
    });
  }, [data, seenSet, showAvail, availCC, sel, selectStation]);

  if (!data) {
    return <div className="ody-loading">Unfolding the map…</div>;
  }

  const selSt = sel ? S.get(sel) : null;
  const propSt = prop?.slug ? S.get(prop.slug) : null;
  const fromSt = prop?.from ? S.get(prop.from) : null;
  const active = solo ?? hoverLine;
  const svgCls = [
    "ody-svg",
    `z${zb}`,
    active ? `hl on-${active}` : "",
    solo ? "solo" : "",
    showSeen ? "show-seen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ody-root">
      <style dangerouslySetInnerHTML={{ __html: lineCss }} />

      <div className="ody-toolbar">
        <div className="ody-chips" role="listbox" aria-label="Lines">
          {solo ? (
            <button className="ody-chip ody-clear" onClick={() => focusLine(null)}>
              ← All lines
            </button>
          ) : null}
          {data.lines.map((l) => (
            <button
              key={l.id}
              className="ody-chip"
              aria-pressed={solo === l.id}
              style={{ ["--lc" as string]: l.color }}
              onMouseEnter={() => setHoverLine(l.id)}
              onMouseLeave={() => setHoverLine(null)}
              onClick={() => focusLine(solo === l.id ? null : l.id)}
            >
              <span className="dot" />
              {l.name_en.replace(/ Line$/, "")}
              <span className="n">{l.stations.length}</span>
            </button>
          ))}
        </div>
        <div className="ody-controls">
          <label className="ody-tog">
            <input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} />
            My films
          </label>
          <label className="ody-tog">
            <input
              type="checkbox"
              checked={showAvail}
              onChange={(e) => setShowAvail(e.target.checked)}
            />
            On my services
          </label>
          <select
            className="ody-cc"
            value={country}
            onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")}
            aria-label="Streaming country"
          >
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </div>
      </div>

      <div className="ody-stage" ref={wrapRef}>
        <svg
          ref={svgRef}
          className={svgCls}
          role="application"
          aria-label="Odyssey cinephile film map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (moved.current <= 6) selectStation(null);
          }}
        >
          <g ref={gRef}>
            {data.bands.map((b) => (
              <g key={b.id} className="band">
                <rect x={16} y={b.y0} width={data.w - 32} height={b.y1 - b.y0} rx={14} />
                <text x={28} y={b.y0 + 24}>
                  {b.label_en.toUpperCase()}
                </text>
              </g>
            ))}
            <g className="grid">
              {data.decades.map((d) => (
                <g key={d.y}>
                  <line x1={d.x} y1={30} x2={d.x} y2={data.h - 10} />
                  <text x={d.x + 4} y={22}>
                    {d.y}
                  </text>
                </g>
              ))}
            </g>
            <g className="lines">
              {data.lines.map((l) => {
                // Split the ride into home-band runs (solid) and continental
                // excursions (ghosted until hover/solo) so the overview stays
                // a legible metro map instead of full-height vertical spaghetti.
                const sts = l.stations
                  .map((s) => S.get(s))
                  .filter((p): p is OdyStation => !!p);
                let solid = "";
                let ghost = "";
                for (let i = 1; i < sts.length; i++) {
                  const a = sts[i - 1];
                  const b = sts[i];
                  const seg = elbowPath([
                    [a.x, a.yy],
                    [b.x, b.yy],
                  ]);
                  if (l.band >= 0 && a.b === l.band && b.b === l.band) solid += seg;
                  else ghost += seg;
                }
                const handlers = {
                  onMouseEnter: () => setHoverLine(l.id),
                  onMouseLeave: () => setHoverLine(null),
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    focusLine(l.id);
                  },
                };
                return (
                  <g key={l.id}>
                    {ghost ? (
                      <path
                        className={`ody-line ln-${l.id} cross`}
                        d={ghost}
                        style={{ stroke: l.color }}
                        {...handlers}
                      />
                    ) : null}
                    {solid ? (
                      <path
                        className={`ody-line ln-${l.id}`}
                        d={solid}
                        style={{ stroke: l.color }}
                        {...handlers}
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>
            {fromSt && propSt ? (
              <path
                className="ody-route"
                d={elbowPath([
                  [fromSt.x, fromSt.yy],
                  [propSt.x, propSt.yy],
                ])}
              />
            ) : null}
            <g className="stations">{stationLayer}</g>
            {propSt ? <circle className="ody-pulse" cx={propSt.x} cy={propSt.yy} r={10} /> : null}
          </g>
        </svg>

        {selSt ? (
          <aside className="ody-card" aria-label="Station">
            <button className="x" onClick={() => selectStation(null)} aria-label="Close">
              ×
            </button>
            <div className="row">
              {selSt.p ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${TMDB_IMG}${selSt.p}`} alt="" width={62} height={93} />
              ) : null}
              <div>
                <div className="ttl">
                  {selSt.t} <span className="yr">{selSt.y ?? ""}</span>
                </div>
                {selSt.tk ? <div className="tko">{selSt.tk}</div> : null}
                {selSt.d ? <div className="dir">{selSt.d}</div> : null}
                <div className="alt" title="Altitude — how much the film asks of you (TakeScore cost)">
                  {"▲".repeat(selSt.c)}
                  {"△".repeat(5 - selSt.c)} <span>altitude {selSt.c}/5</span>
                  {selSt.pk ? <span className="peak"> · canon peak</span> : null}
                </div>
              </div>
            </div>
            {selSt.ln?.length ? (
              <div className="lns">
                {selSt.ln.map((lid) => {
                  const l = data.lines.find((x) => x.id === lid);
                  if (!l) return null;
                  return (
                    <button
                      key={lid}
                      style={{ ["--lc" as string]: l.color }}
                      onClick={() => focusLine(lid)}
                    >
                      <span className="dot" /> {l.name_en}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showAvail && availCC?.[selSt.s]?.length ? (
              <div className="avl">Streaming ({country}): {availCC[selSt.s].slice(0, 4).join(" · ")}</div>
            ) : null}
            <div className="cta">
              <a href={`/film/${selSt.s}`}>Film page</a>
              <a href={`/whereto/${selSt.s}`}>Where to watch</a>
              {uf ? (
                <button
                  className={uf.get({ slug: selSt.s }).seen ? "on" : ""}
                  onClick={() => uf.toggleSeen({ slug: selSt.s })}
                >
                  {uf.get({ slug: selSt.s }).seen ? "✓ Seen" : "Mark seen"}
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <div className="ody-dest">
        <div className="head">
          <h2>Destinations</h2>
          <p>You do not type a destination here — the map proposes one. Pick a mode.</p>
        </div>
        <div className="modes">
          {MODES.map((m) => (
            <button
              key={m.key}
              className="mode"
              aria-pressed={prop?.mode === m.key}
              title={m.hint}
              onClick={() => void runMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {prop ? (
          <div className="result">
            {propSt ? (
              <>
                <span className="dest">
                  {propSt.t} {propSt.y ? `(${propSt.y})` : ""}
                </span>{" "}
                — {prop.reason}{" "}
                <a href={`/film/${propSt.s}`}>Open film page →</a>
              </>
            ) : (
              prop.reason
            )}
          </div>
        ) : null}
        {!uf?.uid ? (
          <p className="anon">
            Sign in and mark films you have seen — the map lights up your territory and every
            proposal starts from where you actually stand.
          </p>
        ) : null}
      </div>
    </div>
  );
}
