"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EntityMap from "@/components/EntityMap";

type Item = {
  title?: string; year?: number | null; director?: string | null; reason?: string;
  slug?: string | null; label?: string | null; text?: string; pos?: number;
  poster?: string | null; profile?: string | null; name?: string | null;
  won?: boolean;
};
type Chip = { text: string; kind?: string };
type Group = { title: string; chips: Chip[] };
export type SurpriseCard = {
  mode: string; label?: string; subject?: string; intro?: string;
  film_title?: string; film_year?: number | null; film_slug?: string;
  director?: string | null; director_slug?: string | null;
  backdrop?: string | null; clip?: string | null; href?: string;
  // misreading / theorist
  line?: string; body?: string; leap?: string; framework?: string; theorist?: string | null;
  fig_label?: string; fig_slug?: string;
  // maps
  mapApi?: string; mapFull?: string;
  // lists / chips
  items?: Item[]; chips?: Chip[]; groups?: Group[];
};

const IMG = "https://image.tmdb.org/t/p";
const NCOMP = 6; // number of randomized editorial compositions
const isMap = (m?: string) => m === "film_map" || m === "director_map" || m === "figure_links";
const isChips = (m?: string) => m === "film_tropes" || m === "film_ideas" || m === "director_ideas";

// The interactive "Surprise me" stage — a random analyzed film seen through one
// curated lens (surprise_home). Video (fixed 16:9) on the left with its caption
// and a red draw-bar; the lens renders in the right panel, which grows down /
// scrolls without stretching the media. Shared by the home hero and /random so
// the two stay pixel-identical. `auto` turns on the 14s self-advance (home only).
export default function SurpriseStage({ auto = false }: { auto?: boolean }) {
  const [hist, setHist] = useState<SurpriseCard[]>([]);
  const [idx, setIdx] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [comps, setComps] = useState<number[]>([]);
  const busy = useRef(false);
  const card = idx >= 0 ? hist[idx] : null;
  const comp = idx >= 0 ? (comps[idx] ?? 0) : 0;

  const draw = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/surprise/home?_=${Date.now()}`, { cache: "no-store" });
      const c = (await r.json()) as SurpriseCard;
      setHist((h) => [...h, c]);
      setComps((cs) => [...cs, Math.floor(Math.random() * NCOMP)]);
      setIdx((i) => i + 1);
    } catch { /* noop */ } finally { setLoading(false); busy.current = false; }
  }, []);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => { if (idx < hist.length - 1) setIdx((i) => i + 1); else draw(); };

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea,a,button,iframe")) { e.preventDefault(); draw(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draw]);

  const paused = useRef(false);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { if (!paused.current && !busy.current) draw(); }, 14000);
    return () => clearInterval(t);
  }, [draw, auto]);

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0`
    : null;

  const filmLine = card
    ? [card.film_title, card.film_year ? `(${card.film_year})` : null].filter(Boolean).join(" ")
    : "";

  return (
    <div className="hs-embed" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
      <div className="vh hs-vh">
        <div className="hs-left">
          <div className="hs-stage">
            <div className={`hs-main hs-comp-${comp}${loading ? " is-load" : ""}`} onClick={() => { if (card?.href) window.location.href = card.href; }}>
              {clipSrc ? (
                <iframe key={`${card!.clip}-${muted ? "m" : "s"}`} className="hs-media" src={clipSrc} title={card?.film_title ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
              ) : card?.backdrop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="hs-media" src={`${IMG}/w1280${card.backdrop}`} alt="" />
              ) : <div className="hs-media hs-media--empty" aria-hidden="true" />}

              {/* editorial layer — corner masthead, rules, an arrow, a peeking glyph,
                  floating supers. Decorative; arranged per composition by .hs-comp-N. */}
              {card ? (
                <div className="hs-ed">
                  <div className="hs-ed-title">
                    {card.film_slug ? <Link href={`/film/${card.film_slug}`}>{card.film_title}</Link> : card.film_title}
                  </div>
                  <div className="hs-ed-meta" aria-hidden="true">
                    {card.film_year ? <span className="hs-ed-yr">{card.film_year}</span> : null}
                    {card.director ? <span className="hs-ed-dir">dir. {card.director}</span> : null}
                  </div>
                  {card.label ? <div className="hs-ed-label" aria-hidden="true">{card.label}</div> : null}
                  <span className="hs-ed-peek" aria-hidden="true">{card.mode === "reception" || card.mode === "misreading" || card.mode === "theorist" ? "“" : "›"}</span>
                  <span className="hs-ed-rule hs-ed-rule--a" aria-hidden="true" />
                  <span className="hs-ed-rule hs-ed-rule--b" aria-hidden="true" />
                  <svg className="hs-ed-arrow" viewBox="0 0 120 34" aria-hidden="true" preserveAspectRatio="none">
                    <path d="M2,17 L104,17 M104,17 L92,9 M104,17 L92,25" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span className="hs-ed-super hs-ed-super--1" aria-hidden="true">{card.framework ?? card.director ?? card.label}</span>
                  <span className="hs-ed-super hs-ed-super--2" aria-hidden="true">No. {(idx % 99) + 1}</span>
                  <span className="hs-ed-ticks" aria-hidden="true" />
                </div>
              ) : null}

              {clipSrc ? (
                <button type="button" className={`hs-mute${muted ? "" : " on"}`} onClick={(e) => { e.stopPropagation(); setMuted((v) => !v); }} aria-label={muted ? "Unmute" : "Mute"}>
                  {muted ? "🔇 Sound off" : "🔊 Sound on"}
                </button>
              ) : null}
            </div>
            <div className="hs-cap">
              {card?.label ? (
                <div className="hs-cap__what"><span className="hs-cap__tag">This surprise</span> {card.label}{card?.subject && card.mode !== "misreading" ? <> — {card.subject}</> : null}</div>
              ) : null}
              <div className="hs-cap__film">
                {card?.film_slug ? <Link href={`/film/${card.film_slug}`}>{filmLine}</Link> : filmLine}
                {card?.director ? <span className="hs-cap__dir"> · dir. {card.director_slug ? <Link href={`/director/${card.director_slug}`}>{card.director}</Link> : card.director}</span> : null}
              </div>
            </div>
          </div>

          <div className="hs-bar">
            <button className="hs-nav" onClick={prev} disabled={idx <= 0} aria-label="Previous">‹</button>
            <button className="hs-draw" onClick={draw} disabled={loading}>↻ Surprise me — hit <kbd>Space</kbd></button>
            <button className="hs-nav" onClick={next} aria-label="Next">›</button>
          </div>
        </div>

        <aside className={`hs-text hs-tcomp-${comp}`}>
          <div className="hs-textwrap">
            {!card ? <div className="hs-skel" /> : isMap(card.mode) ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                {card.intro ? <div className="hs-sub">{card.intro}</div> : null}
                {card.mapApi ? <div className="hs-map"><EntityMap api={card.mapApi} full={card.mapFull ?? "/map"} height={300} /></div> : null}
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            ) : card.mode === "misreading" ? (
              <>
                <span className="hs-chip">{[card.label, card.framework].filter(Boolean).join(" · ")}{card.theorist ? ` · after ${card.theorist}` : ""}</span>
                <div className="hs-line">{card.line}</div>
                {card.fig_label ? <div className="hs-sub">via {card.fig_label} · {filmLine}</div> : null}
                {card.body ? <p className="hs-body">{card.body}</p> : null}
                {card.leap ? <p className="hs-leap"><span>The leap</span> {card.leap}</p> : null}
                {card.href ? <a className="hs-open" href={card.href}>Read the full reading ↗</a> : null}
              </>
            ) : isChips(card.mode) ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <div className="hs-chips">
                  {(card.chips ?? []).map((c, i) => <span key={i} className={`hs-cz${c.kind ? ` hs-cz--${c.kind}` : ""}`}>{c.text}</span>)}
                </div>
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            ) : card.mode === "director_tropes" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                {(card.groups ?? []).map((g, gi) => g.chips.length ? (
                  <div className="hs-grp" key={gi}>
                    <div className="hs-grp__h">{g.title}</div>
                    <div className="hs-chips">{g.chips.map((c, i) => <span key={i} className="hs-cz">{c.text}</span>)}</div>
                  </div>
                ) : null)}
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            ) : card.mode === "director_next" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-list">
                  {(card.items ?? []).map((it, i) => {
                    const inner = (
                      <div className="hs-row">
                        {it.profile ? <img className="hs-face" src={`${IMG}/w185${it.profile}`} alt="" loading="lazy" /> : <span className="hs-face hs-face--ph" aria-hidden="true" />}
                        <span className="hs-row__b">
                          <span className="hs-li__h">{it.name}</span>
                          {it.reason ? <span className="hs-li__t">{it.reason}</span> : null}
                        </span>
                      </div>
                    );
                    return it.slug ? <li className="hs-li" key={i}><Link href={`/director/${it.slug}`}>{inner}</Link></li> : <li className="hs-li" key={i}>{inner}</li>;
                  })}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            ) : card.mode === "why_watch" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-list">
                  {(card.items ?? []).map((it, i) => (
                    <li className="hs-li" key={i}>
                      {it.label ? <span className="hs-li__h">{it.label}</span> : null}
                      <span className="hs-li__t">{it.text}</span>
                    </li>
                  ))}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            ) : card.mode === "theorist" ? (
              <>
                <span className="hs-chip">{[card.label, card.framework].filter(Boolean).join(" · ")}{card.theorist ? ` · ${card.theorist}` : ""}</span>
                <div className="hs-line">{card.subject}</div>
                {card.intro ? <div className="hs-sub">{card.intro}</div> : null}
                {card.line ? <p className="hs-body"><span className="hs-body__k">The reading</span> {card.line}</p> : null}
                {card.body ? <p className="hs-body">{card.body}</p> : null}
                {card.href ? <a className="hs-open" href={card.href}>Meet {card.theorist ?? "the theorist"} ↗</a> : null}
              </>
            ) : card.mode === "reception" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-quotes">
                  {(card.items ?? []).map((it, i) => (
                    <li className="hs-quote" key={i}>
                      <p className="hs-quote__t">“{it.text}”</p>
                      {it.label || it.year ? <span className="hs-quote__a">— {[it.label, it.year].filter(Boolean).join(" · ")}</span> : null}
                    </li>
                  ))}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>The full reception ↗</a> : null}
              </>
            ) : card.mode === "honors" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-honors">
                  {(card.items ?? []).map((it, i) => (
                    <li className={`hs-honor${it.won ? " is-won" : ""}`} key={i}>
                      <span className="hs-honor__m" aria-hidden="true">{it.won ? "🏆" : "◆"}</span>
                      <span className="hs-honor__b">
                        <span className="hs-honor__t">{it.text}</span>
                        {it.label ? <span className="hs-honor__r">{it.label}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>The full record ↗</a> : null}
              </>
            ) : card.mode === "locations" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-list">
                  {(card.items ?? []).map((it, i) => (
                    <li className="hs-li" key={i}>
                      <span className="hs-li__h">📍 {it.text}</span>
                      {it.label ? <span className="hs-li__t">{it.label}</span> : null}
                      {it.reason ? <span className="hs-li__t hs-li__t--mut">{it.reason}</span> : null}
                    </li>
                  ))}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>See it on the atlas ↗</a> : null}
              </>
            ) : card.mode === "question" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                {card.intro ? <div className="hs-sub">{card.intro}</div> : null}
                {card.href ? <a className="hs-open" href={card.href}>Read the answer ↗</a> : null}
              </>
            ) : card.mode === "misreadings_teaser" ? (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                {card.intro ? <div className="hs-sub">{card.intro}</div> : null}
                <ul className="hs-list">
                  {(card.items ?? []).map((it, i) => (
                    <li className="hs-li" key={i}>
                      <span className="hs-li__h">{it.text}</span>
                      {it.label ? <span className="hs-li__t hs-li__t--fw">{it.label}</span> : null}
                    </li>
                  ))}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>All readings, filed ↗</a> : null}
              </>
            ) : (
              <>
                <span className="hs-chip">{card.label}</span>
                <div className="hs-line">{card.subject}</div>
                <ul className="hs-list">
                  {(card.items ?? []).map((it, i) => {
                    const inner = (
                      <div className="hs-row">
                        {it.poster ? <img className="hs-poster" src={`${IMG}/w154${it.poster}`} alt="" loading="lazy" /> : <span className="hs-poster hs-poster--ph" aria-hidden="true" />}
                        <span className="hs-row__b">
                          <span className="hs-li__h">{card.mode === "where_to_start" && it.pos ? <span className="hs-li__pos">{it.pos}</span> : null}{it.title}{it.year ? ` (${it.year})` : ""}{it.director ? ` · dir. ${it.director}` : ""}</span>
                          {it.reason ? <span className="hs-li__t">{it.reason}</span> : null}
                        </span>
                      </div>
                    );
                    return it.slug ? <li className="hs-li" key={i}><Link href={`/film/${it.slug}`}>{inner}</Link></li> : <li className="hs-li" key={i}>{inner}</li>;
                  })}
                </ul>
                {card.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
