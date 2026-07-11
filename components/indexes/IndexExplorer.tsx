"use client";

/**
 * IndexExplorer — the search-first shell for the /film and /director index
 * pages. A large hero search sits on top; below it the page has two states:
 *
 *   · idle  → a "spotlight": the ACTUAL entity page for a random slug, loaded
 *             live in a same-origin iframe (nav hidden, hero doesn't dock),
 *             with a right-side quick scroll-rail and an "open the full page"
 *             button. The next random is PRELOADED in a hidden twin iframe so
 *             reshuffle is instant; the first slug is server-seeded so it loads
 *             from first paint. A tab flips to the full A–Z index (kept mounted
 *             for crawlers).
 *   · typing→ the spotlight/tabs give way to a live results grid — poster cards
 *             for films, circular faces for directors — each a link to the page.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tmdbUrl, type SearchHit } from "@/lib/search-shared";

type Shape = "poster" | "round";
export type PoolItem = { slug: string; label: string; sub?: string | null };

export default function IndexExplorer({
  searchKind, imgShape, basePath, pool, initialSlug, catalogue,
  heroTitle, heroSub, placeholder, spotlightLabel, openLabel,
}: {
  searchKind: string;
  imgShape: Shape;
  basePath: string;
  pool: PoolItem[];
  initialSlug: string | null;            // server-seeded first spotlight (SSR-stable)
  catalogue: ReactNode;
  heroTitle: string;
  heroSub: ReactNode;
  placeholder: string;
  spotlightLabel: string;
  openLabel: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"spotlight" | "index">("spotlight");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // double-buffered iframes: two fixed slots, one visible + one preloading next
  const seed = initialSlug ?? pool[0]?.slug ?? "";
  const [srcs, setSrcs] = useState<[string, string]>([seed, ""]);
  const [active, setActive] = useState<0 | 1>(0);
  const [loaded, setLoaded] = useState<[boolean, boolean]>([false, false]);
  const [sc, setSc] = useState({ top: 0, sh: 1, ch: 1 });
  const [syncTick, setSyncTick] = useState(0);
  const fa = useRef<HTMLIFrameElement>(null);
  const fb = useRef<HTMLIFrameElement>(null);
  const frameRefs = [fa, fb] as const;
  const railRef = useRef<HTMLDivElement>(null);

  const byLabel = (slug: string) => pool.find((p) => p.slug === slug)?.label ?? slug;
  const pickRandom = useCallback((exclude: string[]) => {
    if (!pool.length) return "";
    if (pool.length <= exclude.length + 1) return pool[Math.floor(Math.random() * pool.length)].slug;
    let s = "";
    do { s = pool[Math.floor(Math.random() * pool.length)].slug; } while (exclude.includes(s));
    return s;
  }, [pool]);

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

  // an iframe finished loading (same-origin): hide its nav + native scrollbar,
  // and — for the visible one — sync the rail and start preloading the buffer.
  const onFrameLoad = (i: 0 | 1) => {
    const f = frameRefs[i].current;
    if (f) {
      try {
        const doc = f.contentDocument;
        if (doc) {
          doc.documentElement.setAttribute("data-embed", "");
          const st = doc.createElement("style");
          st.textContent = "html{scrollbar-width:none!important}html::-webkit-scrollbar{display:none!important}";
          doc.head.appendChild(st);
        }
      } catch { /* same-origin should never throw */ }
    }
    setLoaded((l) => { const c = [...l] as [boolean, boolean]; c[i] = true; return c; });
    if (i === active) {
      setSyncTick((t) => t + 1);
      // stagger: only start the buffer once the visible page is ready
      setSrcs((s) => {
        const other = i === 0 ? 1 : 0;
        if (s[other]) return s;
        const c = [...s] as [string, string];
        c[other] = pickRandom([s[i]]);
        return c;
      });
    }
  };

  // keep the rail thumb in sync with the ACTIVE iframe's scroll
  useEffect(() => {
    const f = frameRefs[active].current;
    if (!f) return;
    let win: Window | null = null, doc: Document | null = null;
    try { win = f.contentWindow; doc = f.contentDocument; } catch { return; }
    if (!win || !doc) return;
    const w = win, d = doc;
    const update = () => setSc({ top: w.scrollY, sh: Math.max(1, d.documentElement.scrollHeight), ch: w.innerHeight || 1 });
    w.addEventListener("scroll", update, { passive: true });
    update();
    const t1 = window.setTimeout(update, 500), t2 = window.setTimeout(update, 1500);
    return () => { w.removeEventListener("scroll", update); clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, syncTick]);

  const searching = q.trim().length >= 2;
  const activeSlug = srcs[active];
  const href = activeSlug ? `${basePath}/${activeSlug}` : basePath;

  const reshuffle = () => {
    if (pool.length < 2) return;
    const other = active === 0 ? 1 : 0;
    const cur = srcs[active], buf = srcs[other];
    if (buf) {
      setActive(other);
      const nxt = pickRandom([buf, cur]);
      setSrcs((s) => { const c = [...s] as [string, string]; c[active] = nxt; return c; });
      setLoaded((l) => { const c = [...l] as [boolean, boolean]; c[active] = false; return c; });
    } else {
      const nxt = pickRandom([cur]);
      setSrcs((s) => { const c = [...s] as [string, string]; c[active] = nxt; return c; });
      setLoaded((l) => { const c = [...l] as [boolean, boolean]; c[active] = false; return c; });
    }
  };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hits[0]) router.push(hits[0].href);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  // drag anywhere on the rail to jump the active iframe's scroll
  const railScroll = useCallback((clientY: number) => {
    const f = frameRefs[active].current, rail = railRef.current;
    if (!f?.contentWindow || !f.contentDocument || !rail) return;
    const r = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const sh = f.contentDocument.documentElement.scrollHeight;
    const ch = f.contentWindow.innerHeight;
    f.contentWindow.scrollTo({ top: ratio * Math.max(0, sh - ch) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const onRailDown = (e: React.PointerEvent) => {
    e.preventDefault();
    railScroll(e.clientY);
    const move = (ev: PointerEvent) => railScroll(ev.clientY);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const thumbTop = `${(sc.top / sc.sh) * 100}%`;
  const thumbH = `${Math.max(7, (sc.ch / sc.sh) * 100)}%`;

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
            : <>Type to search, or press <kbd>⌘K</kbd> to search everything on Metatake</>}
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

      {/* Kept mounted even while searching (display:none) so the crawlable A–Z
          links survive; only visually swapped by `searching`. */}
      <div className="xplor-browse" hidden={searching}>
        <div className="xplor-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "spotlight"} data-on={tab === "spotlight" ? "" : undefined} onClick={() => setTab("spotlight")}>✦ Spotlight</button>
          <button role="tab" aria-selected={tab === "index"} data-on={tab === "index" ? "" : undefined} onClick={() => setTab("index")}>▦ A–Z index</button>
        </div>

        <div className="xplor-spot" hidden={tab !== "spotlight"}>
          <div className="xplor-spotbar">
            <span className="xplor-spotlab"><i /> {spotlightLabel}{activeSlug ? <> · <b>{byLabel(activeSlug)}</b></> : null}</span>
            <span className="xplor-spotact">
              <button type="button" className="xplor-another" onClick={reshuffle}>↻ another</button>
              {activeSlug ? <Link className="xplor-open" href={href}>{openLabel}</Link> : null}
            </span>
          </div>
          <div className="xplor-frame">
            <div className="xplor-vp">
              {!loaded[active] ? <div className="xplor-loading"><span className="xplor-spin" /> Opening the live page…</div> : null}
              {[0, 1].map((i) => (
                srcs[i] ? (
                  <iframe
                    key={i}
                    ref={frameRefs[i as 0 | 1]}
                    className={`xplor-iframe${i === active && loaded[i] ? " is-on" : ""}${i === active ? " is-front" : ""}`}
                    src={`${basePath}/${srcs[i]}`}
                    title={byLabel(srcs[i])}
                    onLoad={() => onFrameLoad(i as 0 | 1)}
                  />
                ) : null
              ))}
            </div>
            <div className="xplor-rail" ref={railRef} onPointerDown={onRailDown} title="Drag to scroll">
              <div className="xplor-railthumb" style={{ top: thumbTop, height: thumbH }} />
            </div>
          </div>
        </div>

        <div className="xplor-index" hidden={tab !== "index"}>
          {catalogue}
        </div>
      </div>

      <style>{`
        .xplor{margin:8px 0 40px}
        .xplor-hero{text-align:center;padding:14px 0 6px;border-bottom:1px solid var(--hairline);margin-bottom:20px}
        .xplor-h1{font-family:var(--font-display);font-weight:800;font-size:clamp(30px,6vw,46px);letter-spacing:-.02em;margin:0 0 10px}
        .xplor-sub{font-family:var(--font-display);font-size:clamp(15px,2vw,18px);line-height:1.5;color:var(--ink-soft);max-width:56ch;margin:0 auto 20px;text-align:center;text-wrap:balance}
        .xplor-sub b{color:var(--ink);font-weight:800}
        .xplor-sub .term{color:var(--accent);font-weight:700}
        .xplor-searchwrap{position:relative;max-width:640px;margin:0 auto;display:flex;align-items:center}
        .xplor-mag{position:absolute;left:20px;color:var(--muted);pointer-events:none}
        .xplor-input{width:100%;font-family:var(--font-ui);font-size:17px;color:var(--ink);background:var(--bg);border:1.5px solid var(--hairline-2,#ccc);border-radius:999px;padding:15px 46px 15px 52px;box-shadow:0 4px 20px -8px rgba(0,0,0,.18)}
        .xplor-input:focus{outline:none;border-color:var(--accent,#e3120b);box-shadow:0 6px 26px -8px rgba(227,18,11,.28)}
        .xplor-clear{position:absolute;right:16px;width:26px;height:26px;border-radius:50%;border:0;background:var(--surface-2,#eee);color:var(--muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .xplor-clear:hover{background:var(--accent);color:#fff}
        .xplor-hint{font-family:var(--font-ui);font-size:12.5px;color:var(--subtle,#8f8f8f);margin:11px 0 0}
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

        .xplor-tabs{display:flex;justify-content:center;gap:8px;margin:0 0 18px}
        .xplor-tabs button{font-family:var(--font-ui);font-size:13.5px;font-weight:600;color:var(--muted);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:8px 18px;cursor:pointer}
        .xplor-tabs button[data-on]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
        .xplor-tabs button:not([data-on]):hover{border-color:var(--accent);color:var(--accent)}

        /* spotlight — a WIDE framed window onto the real page (breaks the
           content column to a near-full-bleed, centered on the viewport) */
        .xplor-spot{width:min(94vw,1520px);margin-left:50%;transform:translateX(-50%)}
        .xplor-spotbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 4px 12px;flex-wrap:wrap}
        .xplor-spotlab{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-ui);font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--muted);min-width:0}
        .xplor-spotlab i{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:idxpulse 2.4s infinite;flex:0 0 auto}
        .xplor-spotlab b{color:var(--ink);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .xplor-spotact{display:inline-flex;align-items:center;gap:9px;flex:0 0 auto}
        .xplor-another{font-family:var(--font-ui);font-size:12.5px;font-weight:600;color:var(--muted);background:transparent;border:1px solid var(--hairline-2,#ccc);border-radius:999px;padding:8px 15px;cursor:pointer}
        .xplor-another:hover{border-color:var(--accent);color:var(--accent)}
        .xplor-open{font-family:var(--font-ui);font-size:13px;font-weight:700;color:#fff;background:var(--accent,#e3120b);border-radius:999px;padding:9px 18px;text-decoration:none;white-space:nowrap}
        .xplor-open:hover{background:var(--accent-hover,#c20f09)}

        .xplor-frame{position:relative;display:flex;height:min(88vh,1080px);border:1px solid var(--hairline-2,#ccc);border-radius:14px;overflow:hidden;box-shadow:0 18px 50px -16px rgba(0,0,0,.3);background:var(--bg)}
        .xplor-vp{position:relative;flex:1 1 auto;min-width:0;overflow:hidden;background:var(--bg)}
        .xplor-iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;opacity:0;pointer-events:none;transition:opacity .35s;z-index:1}
        .xplor-iframe.is-front{z-index:2}
        .xplor-iframe.is-on{opacity:1;pointer-events:auto}
        .xplor-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:11px;font-family:var(--font-ui);font-size:14px;color:var(--muted);background:var(--bg);z-index:3}
        .xplor-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--hairline);border-top-color:var(--accent);animation:xplor-spin 0.8s linear infinite}
        @keyframes xplor-spin{to{transform:rotate(360deg)}}
        /* the scroll rail lives on the RIGHT */
        .xplor-rail{position:relative;flex:0 0 14px;background:var(--surface-2,#f1f1f1);border-left:1px solid var(--hairline);cursor:ns-resize;touch-action:none}
        .xplor-railthumb{position:absolute;left:2px;right:2px;min-height:26px;border-radius:6px;background:var(--muted,#9a9a9a);opacity:.55;transition:opacity .15s}
        .xplor-rail:hover .xplor-railthumb{opacity:.85;background:var(--accent)}

        @media(max-width:600px){
          .xplor-thumb--round{width:92px;height:92px}
          .xplor-grid--round{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
          .xplor-frame{height:80vh}
        }
      `}</style>
    </div>
  );
}
