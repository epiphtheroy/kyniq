/**
 * Shared media helpers for the film-scoped reading pages (desk essays,
 * misreadings, Q&A) — 2026-07-08 detail-page redesign.
 *
 * Mid-article stills come from the TMDB gallery (same source as
 * /film/[slug]/gallery): clean (language-less) backdrops first, then by
 * votes. Selection is DETERMINISTIC per film+surface (seeded stride, no
 * Math.random) so ISR renders are stable.
 */

const TMDB = process.env.TMDB_READ_TOKEN;
const IMG = "https://image.tmdb.org/t/p";

type TmdbImg = { file_path: string; iso_639_1: string | null; vote_count?: number };

/** Clean-first backdrop file_paths for a film, cached a day (fetch cache). */
export async function filmBackdropPaths(tmdbId: number | null | undefined, limit = 14): Promise<string[]> {
  if (!TMDB || !tmdbId) return [];
  const base = `https://api.themoviedb.org/3/movie/${tmdbId}/images`;
  const useBearer = TMDB.length > 40;
  const url = useBearer ? base : `${base}?api_key=${TMDB}`;
  const headers: Record<string, string> = useBearer
    ? { Authorization: `Bearer ${TMDB}`, accept: "application/json" }
    : { accept: "application/json" };
  try {
    const r = await fetch(url, { headers, next: { revalidate: 86400 } });
    if (!r.ok) return [];
    const j = (await r.json()) as { backdrops?: TmdbImg[] };
    const sorted = (j.backdrops ?? [])
      .slice()
      .sort((a, b) => (Number(!a.iso_639_1) - Number(!b.iso_639_1)) * -1 || (b.vote_count ?? 0) - (a.vote_count ?? 0));
    return sorted.slice(0, limit).map((b) => b.file_path);
  } catch {
    return [];
  }
}

/** Deterministic n-of-list pick: seeded start + stride so each surface of the
 *  same film shows a different but stable set. Index 0 (the hero backdrop) is
 *  skipped when there is depth to spare. */
export function pickStills(paths: string[], seedStr: string, n: number): string[] {
  if (!paths.length || n <= 0) return [];
  const pool = paths.length > n + 1 ? paths.slice(1) : paths;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 997;
  const out: string[] = [];
  const stride = 1 + (seed % 3);
  for (let i = 0; out.length < Math.min(n, pool.length); i += stride) {
    const p = pool[(seed + i) % pool.length];
    if (!out.includes(p)) out.push(p);
    if (i > pool.length * 3) break;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function figureHtml(path: string, caption: string, inset: boolean): string {
  return (
    `<figure class="rd-fig${inset ? " rd-fig--inset" : ""}">` +
    `<img src="${IMG}/w780${path}" alt="${esc(caption)}" loading="lazy" width="780" height="439" />` +
    `<figcaption>${esc(caption)} · via TMDB</figcaption></figure>`
  );
}

/**
 * Interleave stills into rendered essay HTML (ScreenRant-style). Splits on
 * <h2> section boundaries and drops a figure after every other section; when
 * the essay has few headings, falls back to every ~5 paragraphs. Purely
 * string-level — the essay markup itself is never modified.
 */
export function injectFigures(html: string, paths: string[], filmTitle: string): string {
  if (!paths.length) return html;
  const figs = paths.map((p, i) => figureHtml(p, filmTitle, i % 2 === 1));
  const sections = html.split(/(?=<h2>)/);
  if (sections.length >= 3) {
    const out: string[] = [];
    let f = 0;
    sections.forEach((s, i) => {
      out.push(s);
      if (i > 0 && i % 2 === 1 && f < figs.length) out.push(figs[f++]);
    });
    return out.join("");
  }
  // few/no headings — inject after every 5th paragraph
  const paras = html.split(/(?<=<\/p>)/);
  const out: string[] = [];
  let f = 0;
  paras.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % 5 === 0 && f < figs.length) out.push(figs[f++]);
  });
  return out.join("");
}
