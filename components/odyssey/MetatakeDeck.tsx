"use client";

/**
 * MetatakeDeck — the "For You" draw. A warm box of picks, not a list.
 *
 * On load it auto-deals nine unseen films — a hand drawn from the viewer's own
 * taste (the films they've seen) and their filters (services · a year range · a
 * genre), laid out across three axes: Stable (dead-centre of your taste),
 * Adventure (a step past it), Frontier (a different world). A tiny pile of the
 * films you've seen sits alongside, each card takes Seen / Watchlist / a star
 * rating in place, and a gentle "Draw again ↻" reshuffles the hand.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { AXES, dealJourney, type DealFilters, type DealResult } from "@/lib/odyssey/deal";

const IMG = "https://image.tmdb.org/t/p";
const NOW = 2025;

export default function MetatakeDeck() {
  const uf = useUserFilms();
  const seenSet = uf?.seenSlugs ?? (new Set() as ReadonlySet<string>);

  const [map, setMap] = useState<OdyMap | null>(null);
  const [avail, setAvail] = useState<OdyAvail | null>(null);
  const [country, setCountry] = useState<"KR" | "US">("US");
  const [servicesOnly, setServicesOnly] = useState(false);
  const [yearMin, setYearMin] = useState(1940);
  const [yearMax, setYearMax] = useState(NOW);
  const [genre, setGenre] = useState<number | null>(null);
  const [dealt, setDealt] = useState<DealResult | null>(null);
  const [seed, setSeed] = useState(1);
  const [dealing, setDealing] = useState(false);

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

  const byId = useMemo(() => new Map((map?.stations ?? []).map((s) => [s.s, s])), [map]);
  // the seen pile — up to 9 of the viewer's watched posters (the fan is decorative;
  // the real total shows in the label). Cap must match deck.css's --i centre (4).
  const seenPile = useMemo(() => {
    const out: OdyStation[] = [];
    for (const slug of seenSet) {
      const s = byId.get(slug);
      if (s?.p) out.push(s);
      if (out.length >= 9) break;
    }
    return out;
  }, [seenSet, byId]);

  const deal = useCallback(async () => {
    if (!map) return;
    let a = avail;
    if (servicesOnly && !a) a = await ensureAvail();
    const filters: DealFilters = { yearMin, yearMax, genre, servicesOnly, country };
    const nextSeed = (seed * 48271 + 1) & 0x7fffffff;
    const res = dealJourney(map, seenSet, filters, a ? a[country] ?? {} : null, nextSeed);
    setSeed(nextSeed);
    setDealt(res);
    setDealing(true);
    window.setTimeout(() => setDealing(false), 1400);
  }, [map, avail, servicesOnly, ensureAvail, yearMin, yearMax, genre, country, seed, seenSet]);

  // Auto-deal on load: land the visitor on nine picks, never an empty state.
  // We hold for the map artifact and — when a UserFilms provider is present —
  // for the viewer's seen films to load, so the very first hand is taste-tuned
  // rather than a starter course. Fires once; "Draw again" reshuffles after.
  const ufReady = uf?.ready ?? false;
  const hasProvider = !!uf;
  const autoDealt = useRef(false);
  useEffect(() => {
    if (autoDealt.current || !map) return;
    if (hasProvider && !ufReady) return;
    autoDealt.current = true;
    void deal();
  }, [map, hasProvider, ufReady, deal]);

  // Filters apply live: after the first hand is on screen, any filter change re-draws
  // immediately (with the deal animation) instead of doing nothing until "Draw again".
  const filtersMounted = useRef(false);
  useEffect(() => {
    if (!filtersMounted.current) { filtersMounted.current = true; return; } // skip mount
    if (!autoDealt.current) return; // let the auto-deal land the first hand
    void deal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesOnly, country, yearMin, yearMax, genre]);

  const decades = useMemo(() => {
    const out: number[] = [];
    for (let d = 1900; d <= 2020; d += 10) out.push(d);
    out.push(NOW);
    return out;
  }, []);

  return (
    <section className="deck" aria-label="Films picked for you">
      <div className="deck-inner">
        <div className="deck-eyebrow">Drawn for you</div>
        <h2 className="deck-title">Nine films, picked from your taste</h2>
        <p className="deck-lede">
          Each is scored by how close it sits to the films you've marked seen, then dealt nearest-first across{" "}
          <b style={{ color: AXES[0].color }}>Stable</b>, <b style={{ color: AXES[1].color }}>Adventure</b>, and{" "}
          <b style={{ color: AXES[2].color }}>Frontier</b>. Mark any card seen, save it to your watchlist, or rate it in place.
        </p>

        {/* filters */}
        <div className="deck-filters">
          <label className="deck-chk">
            <input type="checkbox" checked={servicesOnly} onChange={(e) => setServicesOnly(e.target.checked)} />
            Available to stream
          </label>
          <select className="deck-sel" value={country} onChange={(e) => setCountry(e.target.value === "KR" ? "KR" : "US")} aria-label="Country">
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
          <span className="deck-div" />
          <span className="deck-flabel">Years</span>
          <select className="deck-sel" value={yearMin} onChange={(e) => setYearMin(Math.min(+e.target.value, yearMax))} aria-label="From year">
            {decades.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="deck-dash">–</span>
          <select className="deck-sel" value={yearMax} onChange={(e) => setYearMax(Math.max(+e.target.value, yearMin))} aria-label="To year">
            {decades.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="deck-div" />
          <span className="deck-flabel">Genre</span>
          <select className="deck-sel" value={genre ?? ""} onChange={(e) => setGenre(e.target.value === "" ? null : +e.target.value)} aria-label="Genre">
            <option value="">All</option>
            {(map?.genres ?? []).map((g, i) => <option key={g} value={i}>{g}</option>)}
          </select>
        </div>

        {/* your seen pile + the gentle re-draw */}
        <div className="deck-cta-row">
          <div className="deck-seen" title={`${seenSet.size} films seen`}>
            {seenPile.length ? (
              <div className="deck-pile">
                {seenPile.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.s} src={`${IMG}/w92${s.p}`} alt="" className="deck-pile-img" style={{ ["--i" as string]: i }} />
                ))}
              </div>
            ) : (
              <div className="deck-pile deck-pile-empty" aria-hidden="true" />
            )}
            <div className="deck-seen-label">{seenSet.size ? <><b>{seenSet.size}</b> you've seen</> : "Nothing logged yet"}</div>
          </div>

          <button
            className={`deck-draw${dealing || !dealt ? " is-busy" : ""}`}
            onClick={() => void deal()}
            disabled={!dealt}
            aria-label={dealt ? "Draw again" : "Drawing your films"}
          >
            <span className="deck-draw-icon" aria-hidden="true">↻</span>
            <span className="deck-draw-word">{dealt ? "Draw again" : "Drawing…"}</span>
          </button>
        </div>

        {/* the hand — nine picks, always on screen */}
        {dealt ? (
          <div className="deck-axes" key={seed}>
            {AXES.map((ax) => (
              <div className="deck-axis" key={ax.key} style={{ ["--ax" as string]: ax.color, ["--axg" as string]: ax.glow }}>
                <div className="deck-axis-head">
                  <span className="deck-axis-title">{ax.title}<span className="deck-axis-axis"> axis</span></span>
                  <span className="deck-axis-sub">{ax.sub}</span>
                </div>
                <div className="deck-cards">
                  {dealt[ax.key].length === 0 ? (
                    <div className="deck-empty">No new films match these filters — try widening them.</div>
                  ) : dealt[ax.key].map((s, i) => (
                    <Card key={s.s} s={s} idx={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="deck-axes" aria-hidden="true">
            {AXES.map((ax) => (
              <div className="deck-axis" key={ax.key} style={{ ["--ax" as string]: ax.color, ["--axg" as string]: ax.glow }}>
                <div className="deck-axis-head">
                  <span className="deck-axis-title">{ax.title}<span className="deck-axis-axis"> axis</span></span>
                  <span className="deck-axis-sub">{ax.sub}</span>
                </div>
                <div className="deck-cards">
                  {[0, 1, 2].map((i) => <div className="deck-skel" key={i} style={{ ["--i" as string]: i }} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {dealt && dealt.basis === "starter" ? (
          <div className="deck-basis">Drawn as a starter course — the more films you mark as seen, the more these picks fit you.</div>
        ) : !dealt ? (
          <div className="deck-hint">Drawing your films…</div>
        ) : null}
      </div>
    </section>
  );
}

function Card({ s, idx }: { s: OdyStation; idx: number }) {
  const uf = useUserFilms();
  const st = uf?.get({ slug: s.s });
  const seen = st?.seen ?? false;
  const watch = st?.watchlist ?? false;
  const rating = st?.rating ?? 0;

  return (
    <div className="deal-card" style={{ ["--i" as string]: idx }}>
      <div className="deal-card-inner">
        <div className="deal-face deal-back">
          <span className="deal-back-mark">✦</span>
        </div>
        <div className="deal-face deal-front">
          {s.p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="deal-poster" src={`${IMG}/w342${s.p}`} alt={`${s.t} poster`} loading="lazy" />
          ) : (
            <div className="deal-noposter">{s.t.slice(0, 1)}</div>
          )}
          <a className="deal-info" href={`/film/${s.s}`}>
            <div className="deal-ttl">{s.t}</div>
            <div className="deal-meta">
              {s.y ?? ""}{s.d ? ` · ${s.d}` : ""}
              {s.pk ? <span className="deal-peak"> · Canon</span> : null}
              <span className="deal-alt" title="altitude — how much it asks of you"> · {"▲".repeat(s.c)}</span>
            </div>
          </a>
          {uf ? (
            <div className="deal-actions" onClick={(e) => e.stopPropagation()}>
              <button className={`deal-act${seen ? " on" : ""}`} title="Seen" onClick={() => uf.toggleSeen({ slug: s.s })}>✓</button>
              <button className={`deal-act${watch ? " on" : ""}`} title="Watchlist" onClick={() => uf.toggleWatch({ slug: s.s })}>＋</button>
              <div className="deal-stars" role="radiogroup" aria-label={rating ? `Rating: ${rating} of 5` : "Rating"}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`deal-star${rating >= n ? " on" : ""}`}
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    onClick={() => uf.rate({ slug: s.s }, rating === n ? 0 : n)}
                  >★</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
