"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EntityMap from "@/components/EntityMap";

type Item = {
  title?: string; year?: number | null; director?: string | null; reason?: string;
  slug?: string | null; label?: string | null; text?: string; pos?: number;
  poster?: string | null; profile?: string | null; name?: string | null;
};
type Chip = { text: string; kind?: string };
type Group = { title: string; chips: Chip[] };
type Card = {
  mode: string; label?: string; subject?: string; intro?: string;
  film_title?: string; film_year?: number | null; film_slug?: string;
  director?: string | null; director_slug?: string | null;
  backdrop?: string | null; clip?: string | null; href?: string;
  // misreading
  line?: string; body?: string; leap?: string; framework?: string; theorist?: string | null;
  fig_label?: string; fig_slug?: string;
  // maps
  mapApi?: string; mapFull?: string;
  // lists / chips
  items?: Item[]; chips?: Chip[]; groups?: Group[];
};

const IMG = "https://image.tmdb.org/t/p";
const isMap = (m?: string) => m === "film_map" || m === "director_map" || m === "figure_links";
const isChips = (m?: string) => m === "film_tropes" || m === "film_ideas" || m === "director_ideas";

// Home hero — "Surprise me". A random film, drawn one at a time, seen through a
// random lens: a Strong Misreading (≥1 in 3), the film's map, its director's map,
// a figure across films, what to watch next, what recommends it, why watch it, or
// where to start with the director. Video left, caption beneath it, a long red
// space-bar to draw again, and the lens itself rendered in the right panel.
export default function HeroSurprise() {
  const [hist, setHist] = useState<Card[]>([]);
  const [idx, setIdx] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const busy = useRef(false);
  const card = idx >= 0 ? hist[idx] : null;

  const draw = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/surprise/home?_=${Date.now()}`, { cache: "no-store" });
      const c = (await r.json()) as Card;
      setHist((h) => [...h, c]);
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
    const t = setInterval(() => { if (!paused.current && !busy.current) draw(); }, 14000);
    return () => clearInterval(t);
  }, [draw]);

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0`
    : null;

  const filmLine = card
    ? [card.film_title, card.film_year ? `(${card.film_year})` : null].filter(Boolean).join(" ")
    : "";

  return (
    <div className="hero" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
      <div className="wrap">
        <div className="vh hs-vh">
          <div className="hs-left">
            <div className="hs-stage">
              <div className={`hs-main${loading ? " is-load" : ""}`} onClick={() => { if (card?.href) window.location.href = card.href; }}>
                {clipSrc ? (
                  <iframe key={`${card!.clip}-${muted ? "m" : "s"}`} className="hs-media" src={clipSrc} title={card?.film_title ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
                ) : card?.backdrop ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="hs-media" src={`${IMG}/w1280${card.backdrop}`} alt="" />
                ) : <div className="hs-media hs-media--empty" aria-hidden="true" />}
                {clipSrc ? (
                  <button type="button" className={`hs-mute${muted ? "" : " on"}`} onClick={(e) => { e.stopPropagation(); setMuted((v) => !v); }} aria-label={muted ? "Unmute" : "Mute"}>
                    {muted ? "🔇 Sound off" : "🔊 Sound on"}
                  </button>
                ) : null}
              </div>
              <div className="hs-cap">
                <div className="hs-cap__film">
                  {card?.film_slug ? <Link href={`/film/${card.film_slug}`}>{filmLine}</Link> : filmLine}
                  {card?.director ? <span className="hs-cap__dir"> · dir. {card.director_slug ? <Link href={`/director/${card.director_slug}`}>{card.director}</Link> : card.director}</span> : null}
                </div>
                {card?.label ? (
                  <div className="hs-cap__what"><span className="hs-cap__tag">This surprise</span> {card.label}{card?.subject && card.mode !== "misreading" ? <> — {card.subject}</> : null}</div>
                ) : null}
              </div>
            </div>

            <div className="hs-bar">
              <button className="hs-nav" onClick={prev} disabled={idx <= 0} aria-label="Previous">‹</button>
              <button className="hs-draw" onClick={draw} disabled={loading}>↻ Surprise me — hit <kbd>Space</kbd></button>
              <button className="hs-nav" onClick={next} aria-label="Next">›</button>
            </div>
          </div>

          <aside className="hs-text">
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

        <div className="topicchips">
          <Link className="tc" href="/strong-misreadings">Strong Misreadings <span className="ch">›</span></Link>
          <Link className="tc" href="/search?q=grief">Films about grief <span className="ch">›</span></Link>
          <Link className="tc" href="/director">Auteur fingerprints <span className="ch">›</span></Link>
          <Link className="tc" href="/map">The whole map <span className="ch">›</span></Link>
          <Link className="tc" href="/idea">The Real (le réel) <span className="ch">›</span></Link>
        </div>
      </div>
    </div>
  );
}
