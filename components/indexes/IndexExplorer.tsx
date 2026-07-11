"use client";

/**
 * IndexExplorer — the search-first shell for the /film and /director index
 * pages. A large hero search sits on top; below it the page has two states:
 *
 *   · idle  → a single random "spotlight" entity, opened rich (reshuffles), with
 *             a tab to flip to the full A–Z index (kept mounted for crawlers).
 *   · typing→ the spotlight/tabs give way to a live results grid — poster cards
 *             for films, circular faces for directors — each a link to the page.
 *
 * The rich spotlight card + the A–Z catalogue are supplied by the caller
 * (FilmsIndex / DirectorsIndex) so this component stays entity-agnostic.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tmdbUrl, type SearchHit } from "@/lib/search-shared";

type Shape = "poster" | "round";

export default function IndexExplorer<T>({
  searchKind, imgShape, featured, keyOf, renderSpotlight, catalogue,
  heroTitle, heroSub, placeholder, spotlightLabel, cardVariant,
}: {
  searchKind: string;                    // "film" | "director" — /api/search kinds
  imgShape: Shape;                       // result thumbnail shape
  featured: T[];                         // rich featured items (spotlight pool)
  keyOf: (item: T) => string;
  renderSpotlight: (item: T) => ReactNode;
  catalogue: ReactNode;                  // the <Catalogue> element (always mounted)
  heroTitle: string;
  heroSub: ReactNode;
  placeholder: string;
  spotlightLabel: string;                // "A film, at random" etc.
  cardVariant?: "film" | "director";
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"spotlight" | "index">("spotlight");
  const [spot, setSpot] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const hoverRef = useRef(false);

  // random spotlight after mount (SSR renders featured[0] → no hydration drift)
  useEffect(() => {
    if (featured.length > 1) setSpot(Math.floor(Math.random() * featured.length));
  }, [featured.length]);

  // gentle auto-rotation of the spotlight; paused on hover / when searching
  useEffect(() => {
    if (featured.length < 2) return;
    const id = window.setInterval(() => {
      if (hoverRef.current || q.trim().length >= 2) return;
      setSpot((s) => (s + 1) % featured.length);
    }, 15000);
    return () => window.clearInterval(id);
  }, [featured.length, q]);

  // live search → results grid
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(
          `/api/search?mode=lex&kinds=${encodeURIComponent(searchKind)}&limit=30&q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const d = (await r.json()) as { hits?: SearchHit[] };
        setHits(d.hits ?? []);
      } catch { /* aborted */ }
      setBusy(false);
    }, 170);
    return () => clearTimeout(t);
  }, [q, searchKind]);

  const searching = q.trim().length >= 2;
  const reshuffle = () => {
    if (featured.length < 2) return;
    setSpot((s) => { let n = s; while (n === s) n = Math.floor(Math.random() * featured.length); return n; });
  };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hits[0]) router.push(hits[0].href);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const spotlightItem = featured[spot] ?? featured[0];

  return (
    <div className="xplor">
      <div className="xplor-hero">
        <h1 className="xplor-h1">{heroTitle}</h1>
        <p className="xplor-sub">{heroSub}</p>
        <form className="xplor-searchwrap" onSubmit={onSubmit} role="search">
          <svg className="xplor-mag" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 4 4" /></svg>
          <input
            className="xplor-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder} aria-label={placeholder}
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          {q ? <button type="button" className="xplor-clear" aria-label="Clear search" onClick={() => setQ("")}>✕</button> : null}
        </form>
        <p className="xplor-hint">
          {searching
            ? <>{busy ? "Searching…" : `${hits.length} result${hits.length === 1 ? "" : "s"}`}</>
            : <>Type to search, or <kbd>⌘K</kbd> for everything on Metatake</>}
        </p>
      </div>

      {searching ? (
        <div className="xplor-results">
          {!busy && hits.length === 0 ? (
            <p className="xplor-none">No {searchKind === "film" ? "film" : "director"} matches “{q.trim()}”.</p>
          ) : (
            <div className={`xplor-grid xplor-grid--${imgShape}`}>
              {hits.map((h) => (
                <Link key={`${h.kind}:${h.slug}`} href={h.href} className="xplor-rcard">
                  <span className={`xplor-thumb xplor-thumb--${imgShape}`}>
                    {h.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tmdbUrl(h.poster) ?? undefined} alt="" loading="lazy" />
                    ) : <span className="xplor-mono">{h.title.charAt(0)}</span>}
                  </span>
                  <span className="xplor-rt">{h.title}{h.year ? <i> {h.year}</i> : null}</span>
                  {h.sub ? <span className="xplor-rs">{h.sub}</span> : null}
                  {h.is_catalog ? <span className="xplor-rcat">catalog</span> : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Kept mounted even while searching (display:none) so tab state + the
          crawlable A–Z links survive; only visually swapped by `searching`. */}
      <div className="xplor-browse" hidden={searching}>
        <div className="xplor-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "spotlight"} data-on={tab === "spotlight" ? "" : undefined} onClick={() => setTab("spotlight")}>✦ Spotlight</button>
          <button role="tab" aria-selected={tab === "index"} data-on={tab === "index" ? "" : undefined} onClick={() => setTab("index")}>▦ A–Z index</button>
        </div>

        <div className="xplor-spot" hidden={tab !== "spotlight"}
          onMouseEnter={() => (hoverRef.current = true)} onMouseLeave={() => (hoverRef.current = false)}>
          <div className="xplor-spotbar">
            <span className="xplor-spotlab"><i /> {spotlightLabel}</span>
            <button type="button" className="xplor-another" onClick={reshuffle}>↻ another</button>
          </div>
          {spotlightItem ? (
            <article key={keyOf(spotlightItem)} className={`xplor-card${cardVariant === "film" ? " xplor-card--film" : ""}`}>
              {renderSpotlight(spotlightItem)}
            </article>
          ) : null}
        </div>

        <div className="xplor-index" hidden={tab !== "index"}>
          {catalogue}
        </div>
      </div>

      <style>{`
        .xplor{margin:8px 0 40px}
        .xplor-hero{text-align:center;padding:14px 0 6px;border-bottom:1px solid var(--hairline);margin-bottom:20px}
        .xplor-h1{font-family:var(--font-display);font-weight:800;font-size:clamp(30px,6vw,46px);letter-spacing:-.02em;margin:0 0 8px}
        .xplor-sub{font-family:var(--font-display);font-size:clamp(14px,2.2vw,17px);line-height:1.5;color:var(--muted);max-width:60ch;margin:0 auto 18px}
        .xplor-sub .term{color:var(--accent);font-weight:700}
        .xplor-searchwrap{position:relative;max-width:620px;margin:0 auto;display:flex;align-items:center}
        .xplor-mag{position:absolute;left:20px;color:var(--muted);pointer-events:none}
        .xplor-input{width:100%;font-family:var(--font-ui);font-size:17px;color:var(--ink);background:var(--bg);border:1.5px solid var(--hairline-2,#ccc);border-radius:999px;padding:15px 46px 15px 52px;box-shadow:0 4px 20px -8px rgba(0,0,0,.18)}
        .xplor-input:focus{outline:none;border-color:var(--accent,#e3120b);box-shadow:0 6px 26px -8px rgba(227,18,11,.28)}
        .xplor-clear{position:absolute;right:16px;width:26px;height:26px;border-radius:50%;border:0;background:var(--surface-2,#eee);color:var(--muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .xplor-clear:hover{background:var(--accent);color:#fff}
        .xplor-hint{font-family:var(--font-ui);font-size:12px;color:var(--subtle,#8f8f8f);margin:10px 0 0}
        .xplor-hint kbd{font-family:inherit;font-size:11px;border:1px solid var(--hairline,#d8d8d8);border-radius:4px;padding:1px 5px}

        .xplor-results{margin-top:6px}
        .xplor-none{text-align:center;color:var(--muted);font-family:var(--font-ui);font-size:15px;padding:30px 0}
        .xplor-grid{display:grid;gap:22px 16px}
        .xplor-grid--poster{grid-template-columns:repeat(auto-fill,minmax(128px,1fr))}
        .xplor-grid--round{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
        .xplor-rcard{display:flex;flex-direction:column;gap:8px;min-width:0;text-decoration:none;color:inherit}
        .xplor-grid--round .xplor-rcard{align-items:center;text-align:center}
        .xplor-thumb{position:relative;display:block;background:var(--surface-2,#eee);overflow:hidden}
        .xplor-thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .xplor-thumb--poster{width:100%;aspect-ratio:2/3;border-radius:10px;border:1px solid var(--hairline)}
        .xplor-thumb--round{width:112px;height:112px;border-radius:50%;border:2px solid var(--hairline)}
        .xplor-rcard:hover .xplor-thumb--poster{outline:2px solid var(--accent);outline-offset:1px}
        .xplor-rcard:hover .xplor-thumb--round{border-color:var(--accent)}
        .xplor-mono{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:32px;color:var(--muted)}
        .xplor-rt{font-family:var(--font-display);font-weight:700;font-size:14px;line-height:1.25;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .xplor-rt i{font-style:normal;color:var(--subtle);font-weight:400}
        .xplor-rs{font-family:var(--font-ui);font-size:11.5px;color:var(--muted);line-height:1.3;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
        .xplor-grid--round .xplor-rs{-webkit-line-clamp:2}
        .xplor-rcat{font-family:var(--font-ui);font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:var(--subtle)}

        .xplor-tabs{display:flex;justify-content:center;gap:8px;margin:0 0 20px}
        .xplor-tabs button{font-family:var(--font-ui);font-size:13.5px;font-weight:600;color:var(--muted);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:8px 18px;cursor:pointer}
        .xplor-tabs button[data-on]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
        .xplor-tabs button:not([data-on]):hover{border-color:var(--accent);color:var(--accent)}

        .xplor-spot{max-width:720px;margin:0 auto}
        .xplor-spotbar{display:flex;align-items:center;justify-content:space-between;margin:0 2px 12px}
        .xplor-spotlab{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-ui);font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--muted)}
        .xplor-spotlab i{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:idxpulse 2.4s infinite}
        .xplor-another{font-family:var(--font-ui);font-size:12.5px;font-weight:600;color:var(--accent);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:6px 14px;cursor:pointer}
        .xplor-another:hover{background:var(--accent);color:#fff;border-color:var(--accent)}

        /* spotlight card container — reuses the inner FilmCard/DirectorCard
           markup (idx-hero/idx-fbody/idx-dtop…), just a static box around it */
        .xplor-card{background:var(--bg);border:1px solid var(--hairline-2);border-top:3px solid var(--accent);padding:18px 20px 20px;box-shadow:0 12px 34px rgba(0,0,0,.09)}
        .xplor-card--film{padding:0;border-top:none;overflow:hidden}
        .xplor-card--film .idx-hero{height:clamp(180px,34vw,300px)}

        @media(max-width:600px){
          .xplor-thumb--round{width:92px;height:92px}
          .xplor-grid--round{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
        }
      `}</style>
    </div>
  );
}
