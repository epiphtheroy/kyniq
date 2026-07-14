"use client";
/**
 * EmbedBuilder — pick a film, copy a TakeScore badge snippet. Powers /embed.
 * Searches via /api/v1/films, previews the live iframe badge, and hands over
 * both the <script> snippet (do-follow backlink) and the <iframe> fallback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { displayTs } from "@/lib/cinecodex_dims";

const BASE = "https://metatake.net";
type Film = { slug: string; title: string; year: number | null; director: string | null; takescore: number | null };

export default function EmbedBuilder() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Film[]>([]);
  const [picked, setPicked] = useState<Film | null>(null);
  const [copied, setCopied] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) { setResults([]); return; }
    try {
      const r = await fetch(`/api/v1/films?q=${encodeURIComponent(term)}&limit=8`, { cache: "no-store" });
      const d = await r.json();
      setResults(Array.isArray(d.films) ? d.films : []);
    } catch { setResults([]); }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, search]);

  const slug = picked?.slug || "your-film-slug";
  const filmUrl = `${BASE}/film/${slug}`;
  const scriptSnippet =
    `<a class="metatake-takescore" data-film="${slug}" href="${filmUrl}">Metatake TakeScore</a>\n` +
    `<script async src="${BASE}/api/v1/embed.js"></script>`;
  const iframeSnippet =
    `<iframe src="${BASE}/embed/takescore/${slug}" title="Metatake TakeScore" ` +
    `style="border:0;width:230px;height:38px" loading="lazy"></iframe>`;

  async function copy(text: string, which: string) {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 1600); } catch { /* visible + selectable */ }
  }

  return (
    <div className="eb">
      <label className="eb-lab" htmlFor="eb-q">1 · Find your film</label>
      <input
        id="eb-q" className="eb-input" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search a film title or director…" autoComplete="off"
      />
      {results.length > 0 && (
        <div className="eb-results">
          {results.map((f) => (
            <button key={f.slug} type="button" className="eb-row" onClick={() => { setPicked(f); setResults([]); setQ(`${f.title}${f.year ? ` (${f.year})` : ""}`); }}>
              <span>{f.title}{f.year ? ` (${f.year})` : ""}{f.director ? ` · ${f.director}` : ""}</span>
              <span className="eb-ts">{f.takescore != null ? `TS ${displayTs(f.takescore)}` : ""}</span>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <>
          <div className="eb-lab" style={{ marginTop: 18 }}>2 · Preview</div>
          <div className="eb-preview">
            <iframe src={`${BASE}/embed/takescore/${slug}`} title="TakeScore preview" style={{ border: 0, width: 230, height: 40 }} />
          </div>

          <div className="eb-lab" style={{ marginTop: 18 }}>3 · Copy the snippet</div>
          <p className="eb-hint"><b>Recommended (script)</b> — renders a live badge and gives Metatake a real link back. Paste into your page HTML.</p>
          <pre className="eb-code">{scriptSnippet}</pre>
          <button type="button" className="eb-copy" onClick={() => copy(scriptSnippet, "script")}>{copied === "script" ? "Copied ✓" : "Copy script snippet"}</button>

          <p className="eb-hint" style={{ marginTop: 14 }}><b>Fallback (iframe)</b> — for CMSes that strip scripts (e.g. some WordPress editors).</p>
          <pre className="eb-code">{iframeSnippet}</pre>
          <button type="button" className="eb-copy" onClick={() => copy(iframeSnippet, "iframe")}>{copied === "iframe" ? "Copied ✓" : "Copy iframe snippet"}</button>
        </>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .eb{max-width:640px}
  .eb-lab{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0F766E;margin-bottom:6px;display:block}
  .eb-input{width:100%;font:inherit;font-size:1rem;padding:.6em .8em;border:1px solid rgba(0,0,0,.2);border-radius:9px;background:var(--mt-code-bg,#fff);color:inherit;box-sizing:border-box}
  .eb-results{border:1px solid rgba(0,0,0,.12);border-radius:9px;margin-top:6px;overflow:hidden}
  .eb-row{display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;font:inherit;font-size:.86rem;
    padding:.55em .8em;background:none;border:0;border-bottom:1px solid rgba(0,0,0,.06);cursor:pointer;color:inherit}
  .eb-row:hover{background:rgba(15,118,110,.08)}
  .eb-ts{color:#0F766E;font-weight:700;flex-shrink:0}
  .eb-preview{padding:16px;border:1px dashed rgba(0,0,0,.2);border-radius:9px;display:flex;justify-content:center;background:var(--mt-code-bg,rgba(0,0,0,.02))}
  .eb-hint{font-size:.83rem;color:#4b5563;margin:0 0 6px;line-height:1.5}
  .eb-code{white-space:pre-wrap;word-break:break-all;background:#0f172a;color:#e2e8f0;padding:.7em .9em;border-radius:8px;font-size:.76rem;margin:0 0 8px}
  .eb-copy{font:inherit;font-weight:700;font-size:.8rem;cursor:pointer;padding:.5em 1em;border-radius:8px;border:1px solid #0B5E58;background:#0F766E;color:#F0FDFA}
  .eb-copy:hover{background:#0D8A80}
  @media (prefers-color-scheme:dark){.eb-hint{color:#c4c8d0}.eb-row:hover{background:rgba(45,212,191,.12)}}
`;
