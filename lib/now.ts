// Now Playing (/now) — shared types + helpers.
// Spec: hourly/README.md (v2). One piece = one spiking story + one corpus
// anchor + the archive's data record, timestamped to the minute.

export type NowModuleItem = { label: string; href?: string; note?: string };

export type NowModule = {
  type: string; // 'honors' | 'canon' | 'takescore' | 'reception' | 'filmography' | 'list' | 'table'
  title: string;
  note?: string;
  columns?: string[];
  rows?: (string | { text: string; href?: string })[][];
  items?: NowModuleItem[];
};

export type NowSource = { outlet: string; title?: string; url: string };

export type NowCutFloorItem = {
  keyword: string; url?: string; comment: string;
  region?: string; date?: string; outlet?: string;
};

export type NowArchiveLink = { label: string; href: string; note?: string };

export type NowArticle = {
  slug: string;
  headline: string;
  dek: string | null;
  summary: string | null;
  keyword: string | null;
  lane: "direct" | "adjacent" | "exception";
  anchor_type: "film" | "person" | "theorist";
  anchor_slug: string | null;
  anchor_label: string;
  film_slug: string | null;
  dateline: string | null;
  facts_html: string;
  reading_html: string;
  bottom_html: string | null;
  deposit: string | null;
  modules: NowModule[];
  sources: NowSource[];
  image_path: string | null;
  image_alt: string | null;
  cut_floor: NowCutFloorItem[];
  archive_links: NowArchiveLink[];
  status: string;
  update_note: string | null;
  published_at: string;
  updated_at: string;
  created_at: string | null; // when the letter was written (shown alongside published)
};

/** TMDB image URL from a stored path (w1280 for the hero). */
export function tmdbImg(path: string, size = "w1280"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// The clock is part of the product: always show UTC explicitly, and its
// offset from US Eastern (ET) — the reference zone for our newsroom. ET is
// UTC−4 (EDT) or UTC−5 (EST); the offset is computed per-instant so DST is
// automatic. (Owner's rule 2026-07-09.)
const _hm = (d: Date, tz: string) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });

/** ET offset for this instant, e.g. "−4" (EDT) or "−5" (EST). */
export function etOffset(iso: string): string {
  const d = new Date(iso);
  const inTz = (tz: string) => new Date(d.toLocaleString("en-US", { timeZone: tz }));
  const diffH = Math.round((inTz("America/New_York").getTime() - inTz("UTC").getTime()) / 3600000);
  return (diffH >= 0 ? "+" : "−") + Math.abs(diffH);
}

/** Full stamp: "Jul 8, 2026, 14:05 UTC (10:05 ET, UTC−4)". */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${date}, ${_hm(d, "UTC")} UTC (${_hm(d, "America/New_York")} ET, UTC${etOffset(iso)})`;
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Bare UTC time "14:05" — callers append " UTC". */
export function fmtTime(iso: string): string {
  return _hm(new Date(iso), "UTC");
}

/** Compact clock for lists: "14:05 UTC (10:05 ET)". */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return `${_hm(d, "UTC")} UTC (${_hm(d, "America/New_York")} ET)`;
}

/** Internal link for the anchor entity; null when we can't link safely. */
export function anchorHref(a: Pick<NowArticle, "anchor_type" | "anchor_slug">): string | null {
  if (!a.anchor_slug) return null;
  if (a.anchor_type === "film") return `/film/${a.anchor_slug}`;
  if (a.anchor_type === "person") return `/director/${a.anchor_slug}`;
  if (a.anchor_type === "theorist") return `/theorist/${a.anchor_slug}`;
  return null;
}

/** Only site-internal hrefs may render as links inside data modules. */
export function safeHref(href?: string): string | null {
  if (!href) return null;
  return href.startsWith("/") && !href.startsWith("//") ? href : null;
}

/** Data-provenance links inside "The record" tables may point at our own site
 * OR a trustworthy external source (a review URL, a Wikidata record). These
 * come from our own DB, never from model prose. Returns {href, external}. */
export function provenanceHref(href?: string): { href: string; external: boolean } | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return { href, external: false };
  if (href.startsWith("https://")) return { href, external: true };
  return null;
}
