/**
 * apiv1 — clean JSON shapers for the public REST API (/api/v1). Turns the
 * internal FilmPack (from film_context_pack) into stable, documented, machine-
 * friendly shapes with full dimension names and attribution baked in. Reuses the
 * pack as the single source so the API can never drift from copy/download/MCP.
 */
import type { FilmPack } from "@/lib/pack";
import { CODEX_DIMS } from "@/lib/cinecodex_dims";
import { filmLead } from "@/lib/lead";

const SITE = "https://metatake.net";
export const LICENSE = "CC BY-NC 4.0 (attribution required)";
export const ATTRIBUTION = "Metatake";

export function filmUrl(slug: string): string {
  return `${SITE}/film/${slug}`;
}
export function citeAs(pack: Pick<FilmPack, "film" | "source_url">): string {
  const y = pack.film.year ? ` (${pack.film.year})` : "";
  return `Metatake — ${pack.film.title}${y}: ${pack.source_url || filmUrl(pack.film.slug)} (${LICENSE})`;
}

/**
 * Standard attribution block, stamped in-band on every REST/MCP result object
 * (HANDOFF-AI봇맞이하기.md §2.4). CC BY-NC is only a legal backstop — it cannot
 * force attribution — so the credit rides IN the payload: canonical_url +
 * attribution + license + as_of travel with the data even when it is scraped and
 * re-pasted, turning "raw material" into a named source. `as_of` is the data's
 * freshness date (the pack's generated_at) when known, else today.
 */
export function attribution(canonicalUrl: string, asOf?: string | null) {
  return {
    attribution: ATTRIBUTION,
    canonical_url: canonicalUrl,
    license: LICENSE,
    as_of: (asOf && asOf.slice(0, 10)) || new Date().toISOString().slice(0, 10),
  };
}

export interface TakeScoreShape {
  score: number | null;
  value: number | null;
  cost: number | null;
  risk: number | null;
  low_confidence: boolean;
  dimensions: Record<string, { label: string; group: string; score: number | null }>;
}

export function shapeTakeScore(pack: FilmPack): TakeScoreShape | null {
  const ts = pack.takescore;
  if (!ts) return null;
  const dimensions: TakeScoreShape["dimensions"] = {};
  for (const d of CODEX_DIMS) {
    const v = ts.dims?.[d.key];
    dimensions[d.slug] = { label: d.label, group: d.group, score: typeof v === "number" ? v : null };
  }
  return {
    score: ts.score ?? null,
    value: ts.value ?? null,
    cost: ts.cost ?? null,
    risk: ts.risk ?? null,
    low_confidence: !!ts.low_confidence,
    dimensions,
  };
}

/** Full film detail — metadata + TakeScore + readings + figures + tropes + kindred. */
export function shapeFilm(pack: FilmPack) {
  return {
    slug: pack.film.slug,
    title: pack.film.title,
    original_title: pack.film.original_title ?? null,
    year: pack.film.year ?? null,
    director: pack.film.director ?? null,
    ids: {
      imdb: pack.film.imdb_id ?? null,
      tmdb: pack.film.tmdb_id ?? null,
      wikidata: pack.film.wikidata_id ?? null,
    },
    takescore: shapeTakeScore(pack),
    standing: pack.standing ?? null,
    honors: (pack.honors ?? []).map((h) => ({ list: h.list, result: h.result, rank: h.rank ?? null })),
    readings: (pack.readings ?? []).map((r) => ({
      framework: r.framework,
      title: r.title ?? null,
      theorist: r.theorist ?? null,
      concept: r.concept ?? null,
      text: r.text,
    })),
    figures: (pack.figures ?? []).filter((f) => f.label).map((f) => ({
      label: f.label, kind: f.kind ?? null, description: f.description ?? null,
    })),
    tropes: (pack.tropes ?? []).filter((t) => t.title).map((t) => ({
      title: t.title, laconic: t.laconic ?? null, thesis: t.thesis ?? null,
    })),
    kindred: (pack.kindred ?? []).filter((k) => k.title).map((k) => ({
      title: k.title, year: k.year ?? null, slug: k.slug ?? null, shared_threads: k.shared_threads,
    })),
    // Answer-first BLUF digest (§1.1) — byte-identical to the film page + pack lead.
    digest: filmLead({
      title: pack.film.title,
      year: pack.film.year,
      director: pack.film.director,
      takescore: pack.takescore
        ? { value: pack.takescore.value, cost: pack.takescore.cost, risk: pack.takescore.risk, net: pack.takescore.score }
        : null,
    }),
    url: filmUrl(pack.film.slug),
    cite_as: citeAs(pack),
    ...attribution(filmUrl(pack.film.slug), pack.generated_at),
  };
}
