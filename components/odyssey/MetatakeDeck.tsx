"use client";

/**
 * MetatakeDeck — the journey proposal (the actual navigation, not the atlas).
 *
 * A big MET​ATAKE button, with a tiny pile of the films you've seen to its left
 * and the filters (your services · a year range · a genre) above it. Press it
 * and nine unseen films flip up like a dealt hand across three axes —
 * Stable (dead-centre of your taste), Adventure (a step past it),
 * Frontier (a different world). Each card takes Seen / Watchlist /
 * a star rating in place. Re-deal for a fresh hand.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import type { OdyAvail, OdyMap, OdyStation } from "@/lib/odyssey/types";
import { AXES, dealJourney, type Axis, type DealFilters, type DealResult } from "@/lib/odyssey/deal";

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
  // the seen pile — up to 14 of the viewer's watched posters
  const seenPile = useMemo(() => {
    const out: OdyStation[] = [];
    for (const slug of seenSet) {
      const s = byId.get(slug);
      if (s?.p) out.push(s);
      if (out.length >= 14) break;
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

  const decades = useMemo(() => {
    const out: number[] = [];
    for (let d = 1900; d <= 2020; d += 10) out.push(d);
    out.push(NOW);
    return out;
  }, []);

  const totalDealt = dealt ? (["stable", "adventure", "frontier"] as Axis[]).reduce((n, k) => n + dealt[k].length, 0) : 0;

  return (
    <section className="deck" aria-label="Metatake journey">
      <div className="deck-inner">
        <div className="deck-eyebrow">The Journey</div>
        <h2 className="deck-title">The map is the atlas. This is the navigation.</h2>
        <p className="deck-lede">
          From the films you've seen, we chart three ways forward — <b style={{ color: AXES[0].color }}>Stable</b> sits dead-centre of your taste,{" "}
          <b style={{ color: AXES[1].color }}>Adventure</b> a step beyond, <b style={{ color: AXES[2].color }}>Frontier</b> a
          different world entirely. Unseen films only, tuned to your settings.
        </p>

        {/* filters */}
        <div className="deck-filters">
          <label className="deck-chk">
            <input type="checkbox" checked={servicesOnly} onChange={(e) => setServicesOnly(e.target.checked)} />
            On my services only
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

        {/* the button + seen pile */}
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

          <button className={`deck-btn${dealing ? " is-dealing" : ""}`} onClick={() => void deal()} disabled={!map}>
            <span className="deck-btn-mark">✦</span>
            <span className="deck-btn-word">METATAKE</span>
            <span className="deck-btn-sub">{dealt ? "Deal again" : "Deal 9 films"}</span>
          </button>
        </div>

        {/* dealt hand */}
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
          <div className="deck-hint">
            {seenSet.size >= 3
              ? "Press the button and three paths open from your taste."
              : "Sign in and mark a few films you've seen, and the paths will start from your taste. (For now, we deal a starter course.)"}
          </div>
        )}
        {dealt && dealt.basis === "starter" ? (
          <div className="deck-basis">Dealt as a starter course — the more films you mark as seen, the more the picks fit you.</div>
        ) : null}
        {dealt && totalDealt === 0 ? null : null}
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
              <div className="deal-stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`deal-star${rating >= n ? " on" : ""}`}
                    aria-label={`${n} stars`}
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
