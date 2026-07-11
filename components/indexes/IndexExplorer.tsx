"use client";

/**
 * IndexExplorer — the search-first shell for the /film and /director index
 * pages. A compact hero search sits on top; below it two tabs:
 *
 *   · 🎲 random movie/director → the "spotlight": the ACTUAL entity page for a
 *       random data-rich slug, live in a same-origin, box-less, full-bleed
 *       iframe (nav + footer stripped; its own sticky section tabs stay pinned).
 *       Clicking the tab reshuffles to another random; the next one is
 *       PRELOADED in a hidden twin iframe so it's instant, and the first is
 *       server-seeded so it loads from first paint.
 *   · ▦ A–Z index → the full catalogue (every film/director), kept mounted so
 *       the crawlable links survive.
 *
 * Typing swaps both for a live results grid.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tmdbUrl, type SearchHit } from "@/lib/search-shared";

type Shape = "poster" | "round";

export default function IndexExplorer({
  searchKind, imgShape, basePath, pool, initialSlug, catalogue,
  heroTitle, placeholder, reshuffleLabel,
}: {
  searchKind: string;
  imgShape: Shape;
  basePath: string;
  pool: string[];                        // data-rich slugs → the random/spotlight pool
  initialSlug: string | null;            // server-seeded first spotlight (SSR-stable)
  catalogue: ReactNode;
  heroTitle: string;
  placeholder: string;
  reshuffleLabel: string;                // "random movie" / "random director"
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"spotlight" | "index">("spotlight");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // double-buffered iframes: one visible + one preloading the next random
  const seed = initialSlug ?? pool[0] ?? "";
  const [srcs, setSrcs] = useState<[string, string]>([seed, ""]);
  const [active, setActive] = useState<0 | 1>(0);
  const fa = useRef<HTMLIFrameElement>(null);
  const fb = useRef<HTMLIFrameElement>(null);
  const frameRefs = [fa, fb] as const;

  const pickRandom = (exclude: string[]) => {
    if (!pool.length) return "";
    if (pool.length <= exclude.length + 1) return pool[Math.floor(Math.random() * pool.length)];
    let s = "";
    do { s = pool[Math.floor(Math.random() * pool.length)]; } while (exclude.includes(s));
    return s;
  };

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

  const onFrameLoad = (i: 0 | 1) => {
    // strip nav + footer so the embedded page reads as one seamless page
    try { frameRefs[i].current?.contentDocument?.documentElement.setAttribute("data-embed", ""); } catch { /* same-origin */ }
    if (i === active) {
      setSrcs((s) => {
        const other = i === 0 ? 1 : 0;
        if (s[other]) return s;
        const c = [...s] as [string, string];
        c[other] = pickRandom([s[i]]);
        return c;
      });
    }
  };

  const reshuffle = () => {
    if (pool.length < 2) return;
    const other = active === 0 ? 1 : 0;
    const cur = srcs[active], buf = srcs[other];
    if (buf) {
      setActive(other);
      const nxt = pickRandom([buf, cur]);
      setSrcs((s) => { const c = [...s] as [string, string]; c[active] = nxt; return c; });
    } else {
      const nxt = pickRandom([cur]);
      setSrcs((s) => { const c = [...s] as [string, string]; c[active] = nxt; return c; });
    }
  };
  const onRandom = () => { setTab("spotlight"); reshuffle(); };

  const searching = q.trim().length >= 2;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hits[0]) router.push(hits[0].href);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="xplor">
      <div className="xplor-hero">
        <h1 className="xplor-h1">{heroTitle}</h1>
        <form className="xplor-searchwrap" onSubmit={onSubmit} role="search">
          <svg className="xplor-mag" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 4 4" /></svg>
          <input
            className="xplor-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder} aria-label={placeholder}
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          {q ? <button type="button" className="xplor-clear" aria-label="Clear search" onClick={() => setQ("")}>✕</button> : null}
        </form>
        {searching ? (
          <p className="xplor-hint">{busy ? "Searching…" : `${hits.length} result${hits.length === 1 ? "" : "s"}`}</p>
        ) : null}
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

      {/* Kept mounted even while searching (display:none) so the crawlable A–Z
          links survive; only visually swapped by `searching`. */}
      <div className="xplor-browse" hidden={searching}>
        <div className="xplor-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "spotlight"} data-on={tab === "spotlight" ? "" : undefined} onClick={onRandom}>🎲 {reshuffleLabel}</button>
          <button role="tab" aria-selected={tab === "index"} data-on={tab === "index" ? "" : undefined} onClick={() => setTab("index")}>▦ A–Z index</button>
        </div>

        <div className="xplor-spot" hidden={tab !== "spotlight"}>
          <div className="xplor-frame">
            {[0, 1].map((i) => (
              srcs[i] ? (
                <iframe
                  key={i}
                  ref={frameRefs[i as 0 | 1]}
                  className={`xplor-iframe${i === active ? " is-front" : ""}`}
                  src={`${basePath}/${srcs[i]}`}
                  title={srcs[i]}
                  onLoad={() => onFrameLoad(i as 0 | 1)}
                />
              ) : null
            ))}
          </div>
        </div>

        <div className="xplor-index" hidden={tab !== "index"}>
          {catalogue}
        </div>
      </div>

      <style>{`
        .xplor{margin:4px 0 40px}
        .xplor-hero{text-align:center;padding:4px 0 2px;border-bottom:1px solid var(--hairline);margin-bottom:12px}
        .xplor-h1{font-family:var(--font-display);font-weight:700;font-size:clamp(17px,2.4vw,22px);letter-spacing:-.01em;color:var(--muted);margin:0 0 9px;text-transform:none}
        .xplor-searchwrap{position:relative;max-width:600px;margin:0 auto;display:flex;align-items:center}
        .xplor-mag{position:absolute;left:18px;color:var(--muted);pointer-events:none}
        .xplor-input{width:100%;font-family:var(--font-ui);font-size:16px;color:var(--ink);background:var(--bg);border:1.5px solid var(--hairline-2,#ccc);border-radius:999px;padding:12px 44px 12px 46px;box-shadow:0 4px 20px -8px rgba(0,0,0,.16)}
        .xplor-input:focus{outline:none;border-color:var(--accent,#e3120b);box-shadow:0 6px 26px -8px rgba(227,18,11,.28)}
        .xplor-clear{position:absolute;right:14px;width:24px;height:24px;border-radius:50%;border:0;background:var(--surface-2,#eee);color:var(--muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .xplor-clear:hover{background:var(--accent);color:#fff}
        .xplor-hint{font-family:var(--font-ui);font-size:12.5px;color:var(--subtle,#8f8f8f);margin:9px 0 0}

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

        .xplor-tabs{display:flex;justify-content:center;gap:8px;margin:0 0 12px}
        .xplor-tabs button{font-family:var(--font-ui);font-size:13.5px;font-weight:600;color:var(--muted);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:8px 18px;cursor:pointer}
        .xplor-tabs button[data-on]{background:var(--accent,#e3120b);color:#fff;border-color:var(--accent,#e3120b)}
        .xplor-tabs button:not([data-on]):hover{border-color:var(--accent);color:var(--accent)}

        /* tall, box-less, full-bleed frame; the iframe scrolls internally so the
           real page's own sticky section tabs stay pinned as you scroll */
        .xplor-frame{position:relative;width:97vw;margin-left:50%;transform:translateX(-50%);height:min(94vh,1500px);background:var(--bg)}
        .xplor-iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;opacity:0;pointer-events:none;z-index:1}
        .xplor-iframe.is-front{opacity:1;pointer-events:auto;z-index:2}

        @media(max-width:600px){
          .xplor-thumb--round{width:92px;height:92px}
          .xplor-grid--round{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
          .xplor-frame{width:100vw;height:90vh}
        }
      `}</style>
    </div>
  );
}
