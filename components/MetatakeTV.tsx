"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EntityMap from "@/components/EntityMap";
import FilmMap from "@/components/FilmMap";
import type { SurpriseCard } from "@/components/home2/SurpriseStage";

const IMG = "https://image.tmdb.org/t/p";

// ── METATAKE TV — a screen-essay channel (model: MUBI's video essays). The film
// plays center-frame; the lens arrives as a SEQUENCE OF BEATS — one thought at a
// time — in broadcast zones. Fixed furniture: a mastplate top-left (poster +
// title), the METATAKE TV logo top-right, a segmented beat rail. Four visual
// patterns (air / band / ink / wire) per card; every mode an accent colour, every
// statement an entity colour. On-site only (embeds are legal); not a rebroadcast.
//
// Runs two ways: `embed` (a large box inside a scrolling page — /random) or full-
// screen kiosk (/random/v2). `onCard` surfaces the current card so a host page can
// show connected "page-within-page" content beneath it.

const ACCENT: Record<string, string> = {
  misreading: "#E3120B", misreadings_teaser: "#E3120B",
  theorist: "#9B8CFF", reception: "#F2A9B4", honors: "#E0A93E",
  locations: "#43C6B8", question: "#5FB7E8",
  watch_next: "#F08A3C", recommended_by: "#F08A3C", director_next: "#F08A3C",
  why_watch: "#8FBF6F", where_to_start: "#8FBF6F",
  film_map: "#6E9BFF", director_map: "#6E9BFF", figure_links: "#6E9BFF",
  film_tropes: "#D9C08A", film_ideas: "#D9C08A", director_tropes: "#D9C08A", director_ideas: "#D9C08A",
  kindred: "#EF7D9D", figures: "#C8A2E0", invitation: "#5FC9A8", lineage: "#E0A93E",
};
const PATTERNS = ["air", "band", "ink", "wire"] as const;

const ENTITY: Record<string, "film" | "director" | "figure" | "theorist"> = {
  director_map: "director", director_tropes: "director", director_ideas: "director",
  where_to_start: "director", director_next: "director",
  figure_links: "figure", theorist: "theorist",
};
const ENT_COLOR: Record<string, string> = {
  film: "#FFFFFF", director: "#BBD9F5", figure: "#F3D08A", theorist: "#CFC6FF",
};

type Beat = {
  zone: "top" | "sub" | "quote" | "stack" | "chips" | "map" | "atlas";
  kicker?: string; text?: string; sub?: string; won?: boolean;
  chips?: string[]; mapApi?: string; mapFull?: string; hold: number;
};

function chunks(t?: string | null, max = 150): string[] {
  if (!t) return [];
  const sents = t.match(/[^.!?]+[.!?…]+["”')\]]?\s*/g) ?? [t];
  const out: string[] = [];
  let cur = "";
  for (const s of sents) {
    if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = s; }
    else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const hold = (t?: string, extra = 0) =>
  Math.min(12000, Math.max(5200, 3400 + (t ?? "").length * 42)) + extra;
type ItemT = NonNullable<SurpriseCard["items"]>[number];
const listTitle = (it: ItemT) =>
  `${it.title ?? it.name ?? it.text ?? ""}${it.year ? ` (${it.year})` : ""}`;

function compileBeats(card: SurpriseCard): Beat[] {
  const m = card.mode;
  const items = card.items ?? [];
  const b: Beat[] = [];

  if (m === "misreading") {
    b.push({ zone: "top", kicker: ["Strong Misreading", card.framework].filter(Boolean).join(" · ") + (card.theorist ? ` · after ${card.theorist}` : ""), text: card.line, hold: hold(card.line, 1400) });
    for (const c of chunks(card.body).slice(0, 4)) b.push({ zone: "sub", text: c, hold: hold(c) });
    if (card.leap) b.push({ zone: "sub", kicker: "The leap", text: card.leap, hold: hold(card.leap, 800) });
  } else if (m === "theorist") {
    b.push({ zone: "top", kicker: ["Through a lens", card.framework].filter(Boolean).join(" · "), text: card.subject, hold: hold(card.subject, 1000) });
    for (const c of chunks(card.intro).slice(0, 2)) b.push({ zone: "sub", kicker: card.theorist ?? undefined, text: c, hold: hold(c) });
    if (card.line) b.push({ zone: "sub", kicker: "The reading", text: card.line, hold: hold(card.line, 800) });
  } else if (m === "reception") {
    b.push({ zone: "top", kicker: "What critics said", text: card.subject, hold: hold(card.subject) });
    for (const it of items.slice(0, 4)) {
      const sub = [it.label, it.year ? String(it.year) : null].filter(Boolean).join(" · ");
      b.push({ zone: "quote", text: it.text, sub, hold: hold(it.text, 1000) });
    }
  } else if (m === "honors") {
    b.push({ zone: "top", kicker: "The record", text: card.subject, hold: hold(card.subject) });
    for (const it of items.slice(0, 6)) b.push({ zone: "stack", text: it.text, sub: it.label ?? undefined, won: !!it.won, hold: 3300 });
  } else if (m === "question") {
    b.push({ zone: "top", kicker: "A question people ask", text: card.subject, hold: hold(card.subject, 1200) });
    for (const c of chunks(card.intro).slice(0, 2)) b.push({ zone: "sub", text: c, hold: hold(c) });
  } else if (m === "locations") {
    b.push({ zone: "top", kicker: "On location", text: card.subject, sub: card.intro ?? undefined, hold: hold(card.subject, 800) });
    b.push({ zone: "atlas", hold: 17000 });
  } else if (m === "kindred") {
    b.push({ zone: "top", kicker: "Kindred films", text: card.subject, sub: card.intro ?? undefined, hold: hold(card.subject) });
    for (const it of items.slice(0, 5)) b.push({ zone: "stack", text: listTitle(it), hold: 3400 });
  } else if (m === "figures") {
    const figs = items.map((it) => it.text ?? "").filter(Boolean);
    b.push({ zone: "top", kicker: "The figures", text: card.subject, sub: card.intro ?? undefined, hold: hold(card.subject) });
    if (figs.length) b.push({ zone: "chips", chips: figs.slice(0, 14), hold: 9000 });
  } else if (m === "invitation") {
    b.push({ zone: "top", kicker: "An invitation", text: card.subject, hold: hold(card.subject, 1000) });
    for (const c of chunks(card.body).slice(0, 3)) b.push({ zone: "sub", text: c, hold: hold(c) });
  } else if (m === "lineage") {
    b.push({ zone: "top", kicker: "In the canon", text: card.subject, sub: card.intro ?? undefined, hold: hold(card.subject) });
    for (const it of items.slice(0, 6)) b.push({ zone: "stack", text: it.text ?? "", sub: it.label ?? undefined, won: true, hold: 3300 });
  } else if (m === "misreadings_teaser") {
    b.push({ zone: "top", kicker: "Read against the grain", text: card.subject, hold: hold(card.subject) });
    for (const it of items.slice(0, 4)) b.push({ zone: "stack", text: it.text ?? "", sub: it.label ?? undefined, hold: 3400 });
  } else if (m === "why_watch") {
    b.push({ zone: "top", kicker: "Why watch", text: card.subject, hold: hold(card.subject) });
    for (const it of items.slice(0, 4)) b.push({ zone: "stack", text: it.label ?? it.text ?? "", sub: it.label ? it.text : undefined, hold: 3600 });
  } else if (m === "watch_next" || m === "recommended_by" || m === "where_to_start" || m === "director_next") {
    b.push({ zone: "top", kicker: card.label, text: card.subject, hold: hold(card.subject) });
    for (const it of items.slice(0, 5)) b.push({ zone: "stack", text: `${m === "where_to_start" && it.pos ? `${it.pos}. ` : ""}${listTitle(it)}`, sub: it.reason ?? undefined, hold: 3500 });
  } else if (m === "film_tropes" || m === "film_ideas" || m === "director_tropes" || m === "director_ideas") {
    const all = (card.chips ?? (card.groups ?? []).flatMap((g) => g.chips)).map((c) => c.text);
    b.push({ zone: "top", kicker: card.label, text: card.subject, hold: hold(card.subject) });
    for (let i = 0; i < Math.min(all.length, 20); i += 10)
      b.push({ zone: "chips", chips: all.slice(i, i + 10), hold: 7600 });
  } else if (m === "film_map" || m === "director_map" || m === "figure_links") {
    b.push({ zone: "top", kicker: card.label, text: card.subject, sub: card.intro ?? undefined, hold: hold(card.subject, 1600) });
    if (card.mapApi) b.push({ zone: "map", mapApi: card.mapApi, mapFull: card.mapFull, hold: 16000 });
  } else {
    b.push({ zone: "top", kicker: card.label, text: card.subject ?? card.line, sub: card.intro ?? undefined, hold: hold(card.subject ?? card.line, 1200) });
    for (const c of chunks(card.body ?? card.intro).slice(0, 2)) b.push({ zone: "sub", text: c, hold: hold(c) });
  }
  return b.slice(0, 9);
}

export default function MetatakeTV({ embed = false, onCard }: { embed?: boolean; onCard?: (c: SurpriseCard | null) => void }) {
  const [hist, setHist] = useState<SurpriseCard[]>([]);
  const [pats, setPats] = useState<number[]>([]);
  const [idx, setIdx] = useState(-1);
  const [beatIdx, setBeatIdx] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const busy = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = idx >= 0 ? hist[idx] : null;
  const pattern = PATTERNS[idx >= 0 ? (pats[idx] ?? 0) : 0];
  const beats = useMemo(() => (card ? compileBeats(card) : []), [card]);
  const beat = beats[beatIdx] ?? null;
  const acc = ACCENT[card?.mode ?? ""] ?? "#C8102E";
  const ent = ENT_COLOR[ENTITY[card?.mode ?? ""] ?? "film"];

  const draw = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      let c: SurpriseCard | null = null;
      for (let t = 0; t < 4; t++) {
        const r = await fetch(`/api/surprise/home?_=${Date.now()}-${t}`, { cache: "no-store" });
        const j = (await r.json()) as SurpriseCard;
        c = c ?? j;
        if (j.clip) { c = j; break; }
      }
      if (!c) return;
      const cc = c;
      setHist((h) => [...h, cc]);
      setPats((p) => [...p, Math.floor(Math.random() * PATTERNS.length)]);
      setIdx((i) => i + 1);
    } catch { /* noop */ } finally { busy.current = false; }
  }, []);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = useCallback(() => {
    setIdx((i) => {
      if (i < hist.length - 1) return i + 1;
      draw();
      return i;
    });
  }, [hist.length, draw]);
  const nextRef = useRef(next); nextRef.current = next;

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { setBeatIdx(0); }, [idx]);
  // surface the current card so a host page can render connected content
  useEffect(() => { onCard?.(card ?? null); /* eslint-disable-next-line */ }, [idx]);

  // kiosk (fullscreen only): lock the page so site chrome can't scroll in
  useEffect(() => {
    if (embed) return;
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOv; };
  }, [embed]);

  useEffect(() => {
    if (!playing || !beat) return;
    const t = setTimeout(() => {
      if (beatIdx < beats.length - 1) setBeatIdx((i) => i + 1);
      else nextRef.current();
    }, beat.hold);
    return () => clearTimeout(t);
  }, [playing, beat, beatIdx, beats.length, nonce]);

  const postYT = useCallback((func: string) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }, []);
  useEffect(() => { postYT(playing ? "playVideo" : "pauseVideo"); }, [playing, postYT, idx]);
  const togglePlay = () => setPlaying((p) => { if (!p) setNonce((n) => n + 1); return !p; });

  // auto-hide controls (fullscreen only); in embed they stay visible
  const wake = useCallback(() => {
    if (embed) return;
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3200);
  }, [embed]);
  useEffect(() => { wake(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [wake]);

  // keyboard only in fullscreen (embed must not hijack page scroll with Space)
  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); wake(); }
      else if (e.code === "ArrowRight") { nextRef.current(); wake(); }
      else if (e.code === "ArrowLeft") { prev(); wake(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, wake]);

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`
    : null;

  const statement = beats[0]?.zone === "top" ? beats[0] : null;
  const stacked = beats.slice(0, beatIdx + 1).filter((x) => x.zone === "stack");
  const bk = `${idx}-${beatIdx}`;
  const rootBase = embed ? "tv-embed" : "svchan";
  const rootUi = embed ? "tv-embed--ui" : (uiVisible ? "svchan--ui" : "");

  return (
    <div
      className={`${rootBase} ${rootUi} sv2 sv2-p-${pattern} sv2-m-${card?.mode ?? "boot"}`}
      style={{ "--acc": acc, "--ent": ent } as React.CSSProperties}
      onMouseMove={wake}
    >
      <div className="svc-bed">
        {clipSrc ? (
          <iframe ref={iframeRef} key={card!.clip} className="svc-media" src={clipSrc}
            title={card?.film_title ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
        ) : <div className="svc-media svc-media--empty" aria-hidden="true" />}
      </div>
      <div className="svc-scrim" aria-hidden="true" />

      {card ? (
        <a className="sv2-mast" href={card.film_slug ? `/film/${card.film_slug}` : undefined}>
          {card.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sv2-mast__p" src={`${IMG}/w154${card.poster}`} alt="" />
          ) : null}
          <span className="sv2-mast__b">
            <span className="sv2-mast__t">{card.film_title}</span>
            <span className="sv2-mast__m">
              {card.film_year ? <b>{card.film_year}</b> : null}
              {card.director ? <i>dir. {card.director}</i> : null}
            </span>
          </span>
        </a>
      ) : null}

      <div className="sv2-tv" aria-hidden="true">
        <span className="sv2-tv__name">METATAKE</span>
        <span className="sv2-tv__box">TV</span>
        <span className="sv2-tv__live" data-live={playing ? "1" : "0"}>{playing ? "● ON AIR" : "❚❚ PAUSED"}</span>
      </div>

      <div className="sv2-segs" aria-hidden="true">
        {beats.map((x, i) => (
          <span key={i} className={`sv2-seg${i < beatIdx ? " done" : ""}`}>
            {i === beatIdx ? (
              <i key={`${bk}-${nonce}`} style={{ animationDuration: `${x.hold}ms`, animationPlayState: playing ? "running" : "paused" }} />
            ) : null}
          </span>
        ))}
      </div>

      {statement ? (
        <div key={`st-${idx}`} className={`sv2-top${beatIdx > 0 ? " is-min" : ""}`}>
          {statement.kicker ? <span className="sv2-kick">{statement.kicker}</span> : null}
          <h2 className="sv2-state">{statement.text}</h2>
          {statement.sub && beatIdx === 0 ? <p className="sv2-dek">{statement.sub}</p> : null}
        </div>
      ) : null}

      {beat && beat.zone === "sub" ? (
        <div key={bk} className="sv2-sub" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          <div className="sv2-band">
            {beat.kicker ? <span className="sv2-kick sv2-kick--sub">{beat.kicker}</span> : null}
            <p className="sv2-subtxt">{beat.text}</p>
            {beat.sub ? <p className="sv2-subsub">{beat.sub}</p> : null}
          </div>
        </div>
      ) : beat && beat.zone === "quote" ? (
        <figure key={bk} className="sv2-quote" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          <span className="sv2-quote__mark" aria-hidden="true">“</span>
          <blockquote>{beat.text}</blockquote>
          {beat.sub ? <figcaption>— {beat.sub}</figcaption> : null}
        </figure>
      ) : beat && beat.zone === "chips" ? (
        <div key={bk} className="sv2-chips" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          {(beat.chips ?? []).map((c, i) => (
            <span key={i} className="sv2-chip" style={{ animationDelay: `${i * 90}ms` }}>{c}</span>
          ))}
        </div>
      ) : beat && beat.zone === "map" ? (
        <div key={`map-${idx}`} className="sv2-map">
          <div className="sv2-map__h">
            <span className="sv2-kick sv2-kick--sub">{card?.label ?? "The map"}</span>
            <a href={beat.mapFull ?? "/map"}>Explore ↗</a>
          </div>
          <EntityMap api={beat.mapApi!} full={beat.mapFull ?? "/map"} height={300} />
        </div>
      ) : beat && beat.zone === "atlas" && card?.film_slug ? (
        <div key={`atlas-${idx}`} className="sv2-atlas">
          <div className="sv2-map__h">
            <span className="sv2-kick sv2-kick--sub">On the atlas</span>
            <a href={`/film/${card.film_slug}#df-atlas`}>Open ↗</a>
          </div>
          <FilmMap endpoint={`/api/geo?film=${card.film_slug}`} filmSlug={card.film_slug} height={300} panelSide="left" fitMaxZoom={13} />
        </div>
      ) : null}

      {stacked.length && beat?.zone === "stack" ? (
        <ul className="sv2-stack">
          {stacked.map((s, i) => (
            <li key={i} className={`sv2-stkrow${s.won ? " is-won" : ""}${i === stacked.length - 1 ? " is-new" : ""}`}>
              <b>{s.won ? "🏆" : "◆"}</b>
              <span className="sv2-stkrow__b">
                <span className="sv2-stkrow__t">{s.text}</span>
                {s.sub ? <span className="sv2-stkrow__s">{s.sub}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="svc-ctrls">
        <button className="svc-btn" onClick={prev} aria-label="Previous" disabled={idx <= 0}>‹</button>
        <button className="svc-btn svc-btn--play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "►"}</button>
        <button className="svc-btn" onClick={() => nextRef.current()} aria-label="Next">›</button>
        {clipSrc ? <button className="svc-btn" onClick={() => setMuted((v) => !v)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button> : null}
        {card?.href ? <a className="svc-btn svc-btn--open" href={card.href}>Full info ↗</a> : null}
        {!embed ? <span className="svc-hint">Space = pause · ← → = skip</span> : null}
      </div>
    </div>
  );
}
