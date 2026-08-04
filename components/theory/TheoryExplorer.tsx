"use client";

/**
 * TheoryExplorer — the shared search-first shell for the three "how cinema is
 * read" index pages: /concept, /theorist, /tradition. They are one conceptual
 * space, so they share one shell:
 *
 *   · a value-forward hero (the pitch is not "theory defined" but "the films
 *     that stage each idea" — cinema as the reproducible medium where an
 *     abstract concept becomes something you can watch);
 *   · one unified search that spans all three axes at once (concepts +
 *     theorists + traditions), grouped by kind — so from any of the three
 *     pages you can jump straight to any theory entity. This is the fix for
 *     "there was no search box";
 *   · an axis switcher (Concepts · Theorists · Traditions) rendered as real
 *     <Link>s to the three canonical routes, so each stays a crawlable page
 *     with its own metadata/JSON-LD (SEO intact);
 *   · the axis-specific browse passed in as server-rendered children (kept
 *     mounted while searching so the crawlable A–Z links survive).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkLines } from "@/components/Skeleton";
import type { SearchHit } from "@/lib/search-shared";

type Axis = "concepts" | "theorists" | "traditions";

const TABS: { axis: Axis; label: string; href: string }[] = [
  { axis: "concepts", label: "Concepts", href: "/concept" },
  { axis: "theorists", label: "Theorists", href: "/theorist" },
  { axis: "traditions", label: "Traditions", href: "/tradition" },
];

// group order + human header for the unified results
const GROUPS: { key: string; head: string; kinds: string[] }[] = [
  { key: "concept", head: "Concepts", kinds: ["idea"] },
  { key: "theorist", head: "Theorists", kinds: ["theorist"] },
  { key: "tradition", head: "Traditions", kinds: ["tradition"] },
];

export default function TheoryExplorer({
  axis, heroTitle, heroLede, children,
}: {
  axis: Axis;
  heroTitle: string;
  heroLede: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
          `/api/search?mode=lex&kinds=idea,theorist,tradition&limit=48&q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const d = (await r.json()) as { hits?: SearchHit[] };
        setHits(d.hits ?? []);
      } catch { /* aborted */ }
      setBusy(false);
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const searching = q.trim().length >= 2;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hits[0]) router.push(hits[0].href);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const grouped = GROUPS
    .map((g) => ({ ...g, rows: hits.filter((h) => g.kinds.includes(h.kind)) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="thx">
      <div className="thx-hero">
        <p className="thx-eyebrow">Theory, seen in cinema</p>
        <h1 className="thx-h1">{heroTitle}</h1>
        <p className="thx-lede">{heroLede}</p>

        <form className="thx-searchwrap" onSubmit={onSubmit} role="search">
          <svg className="thx-mag" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 4 4" /></svg>
          <input
            className="thx-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search a concept, a thinker, a tradition…" aria-label="Search theory"
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          {q ? <button type="button" className="thx-clear" aria-label="Clear search" onClick={() => setQ("")}>✕</button> : null}
        </form>

        <nav className="thx-tabs" aria-label="Theory axes">
          {TABS.map((t) => (
            <Link key={t.axis} href={t.href} className="thx-tab" data-on={t.axis === axis ? "" : undefined} aria-current={t.axis === axis ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {searching ? (
        <div className="thx-results">
          {busy && grouped.length === 0 ? (
            // was: a bare "Searching…" line
            <SkLines count={8} label="Searching concepts, theorists and traditions" />
          ) : grouped.length === 0 ? (
            <p className="thx-msg">No concept, theorist, or tradition matches “{q.trim()}”. <Link href={`/search?q=${encodeURIComponent(q.trim())}`}>Search everything →</Link></p>
          ) : (
            grouped.map((g) => (
              <section key={g.key} className="thx-rgroup">
                <h2 className="thx-rhead">{g.head} <span>{g.rows.length}</span></h2>
                <ul className="thx-rlist mo-stagger">
                  {g.rows.map((h) => (
                    <li key={`${h.kind}:${h.slug}`}>
                      <Link href={h.href} className="thx-rrow">
                        <span className="thx-rt">{h.title}</span>
                        {h.sub ? <span className="thx-rs">{h.sub}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : null}

      {/* Browse stays mounted (display:none while searching) so the crawlable
          A–Z / domain links always exist in the DOM for bots. */}
      <div className="thx-browse" hidden={searching}>
        {children}
      </div>

      <style>{`
        .thx{margin:2px 0 46px}
        .thx-hero{text-align:center;max-width:760px;margin:0 auto;padding:6px 0 4px}
        .thx-eyebrow{font-family:var(--font-ui);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#e3120b);margin:0 0 10px}
        .thx-h1{font-family:var(--font-display);font-weight:700;font-size:clamp(30px,4.4vw,44px);letter-spacing:-.015em;line-height:1.04;margin:0 0 12px;color:var(--ink)}
        .thx-lede{font-family:var(--font-ui);font-size:16px;line-height:1.6;color:var(--ink2,#444);max-width:60ch;margin:0 auto 20px}
        .thx-lede a{color:inherit;text-decoration:underline;text-decoration-color:var(--hairline-2,#ccc);text-underline-offset:2px}
        .thx-lede a:hover{text-decoration-color:var(--accent,#e3120b)}

        .thx-searchwrap{position:relative;max-width:600px;margin:0 auto 16px;display:flex;align-items:center}
        .thx-mag{position:absolute;left:18px;color:var(--muted);pointer-events:none}
        .thx-input{width:100%;font-family:var(--font-ui);font-size:16px;color:var(--ink);background:var(--bg);border:1.5px solid var(--hairline-2,#ccc);border-radius:999px;padding:13px 44px 13px 46px;box-shadow:0 4px 22px -10px rgba(0,0,0,.22);appearance:none;-webkit-appearance:none}
        .thx-input::-webkit-search-cancel-button,.thx-input::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}
        .thx-input:focus{outline:none;border-color:var(--accent,#e3120b);box-shadow:0 6px 28px -8px rgba(227,18,11,.28)}
        .thx-clear{position:absolute;right:14px;width:24px;height:24px;border-radius:50%;border:0;background:var(--surface-2,#eee);color:var(--muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .thx-clear:hover{background:var(--accent);color:#fff}

        .thx-tabs{display:inline-flex;gap:4px;padding:4px;margin:2px auto 0;border:1px solid var(--hairline);border-radius:999px;background:var(--surface,rgba(0,0,0,.02))}
        .thx-tab{font-family:var(--font-ui);font-size:13.5px;font-weight:600;color:var(--muted);text-decoration:none;padding:7px 18px;border-radius:999px;transition:background .12s,color .12s}
        .thx-tab:hover{color:var(--ink)}
        .thx-tab[data-on]{background:var(--accent,#e3120b);color:#fff}

        .thx-results{max-width:820px;margin:18px auto 0}
        .thx-msg{text-align:center;color:var(--muted);font-family:var(--font-ui);font-size:15px;padding:26px 0}
        .thx-msg a{color:var(--accent);text-decoration:none}
        .thx-rgroup{margin:0 0 22px}
        .thx-rhead{font-family:var(--font-ui);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 6px;border-bottom:1px solid var(--hairline);padding-bottom:6px}
        .thx-rhead span{color:var(--subtle,#999);margin-left:4px}
        .thx-rlist{list-style:none;margin:0;padding:0;display:grid;gap:0;grid-template-columns:1fr}
        @media(min-width:680px){.thx-rlist{grid-template-columns:1fr 1fr;column-gap:28px}}
        .thx-rrow{display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--hairline);text-decoration:none;color:var(--ink)}
        .thx-rrow:hover .thx-rt{color:var(--accent);text-decoration:underline}
        .thx-rt{font-family:var(--font-display);font-size:15px;flex:0 1 auto}
        .thx-rs{font-family:var(--font-ui);font-size:12px;color:var(--muted);margin-left:auto;text-align:right;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

        .thx-browse{margin-top:22px}
      `}</style>
    </div>
  );
}
