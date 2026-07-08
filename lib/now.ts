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

export type NowCutFloorItem = { keyword: string; url?: string; comment: string };

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
};

/** TMDB image URL from a stored path (w1280 for the hero). */
export function tmdbImg(path: string, size = "w1280"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** "Jul 8, 2026, 14:05 UTC" — the piece's clock is part of the product. */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
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
