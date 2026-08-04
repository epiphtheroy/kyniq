/**
 * Watch preferences — the web's port of the app's three axes.
 * (정본: mobile/src/editions.ts + mobile/src/state/prefs.tsx, owner 2026-08-03)
 *
 * The app settled a question the web never asked: "what do I watch on" and "what
 * language are films NAMED in" are different settings, and neither one is the
 * language of the interface.
 *
 *   country + providers — WHERE you watch. Drives every availability query
 *                        (film_availability, cinecodex_ranked's watch args).
 *   contentLang         — WHAT LANGUAGE the film is named in. Drives the TMDB
 *                        release-title projection (films.title_<loc>, migration
 *                        0121) at render time. Independent of country entirely:
 *                        someone in the US on US services may still want films
 *                        named in Korean.
 *   the UI              — stays English. Not a setting; see mobile UI_LOCALE.
 *                        (/ko is a separate, server-rendered projection of the
 *                        whole site — a different mechanism with different SEO
 *                        rules, and it is not what this preference is for.)
 *
 * Storage is local-first under one key, the same `mt-watch-prefs` the Screener
 * and the Marquee already shared — so an older reader that only knows
 * {country, providers} keeps working against the superset.
 */

/* ------------------------------------------------------------------ language */

/** The languages films can be NAMED in. Must match migration 0121's columns. */
export type ContentLang = "en" | "ko" | "es" | "ja" | "zh" | "fr" | "hi";

export type LangOption = {
  code: ContentLang;
  /** Endonym — a language picker is the one place you never translate. */
  label: string;
  /** English name, so an English-reading viewer can find it. */
  english: string;
};

/** Kept in step with mobile/src/editions.ts CONTENT_LANGS. */
export const CONTENT_LANGS: LangOption[] = [
  { code: "en", label: "English", english: "English" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "zh", label: "中文", english: "Chinese" },
  { code: "fr", label: "Français", english: "French" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
];

export const DEFAULT_CONTENT_LANG: ContentLang = "en";

export function isContentLang(v: unknown): v is ContentLang {
  return typeof v === "string" && CONTENT_LANGS.some((l) => l.code === v);
}

export function langLabel(code: ContentLang): string {
  return CONTENT_LANGS.find((l) => l.code === code)?.label ?? "English";
}

/* --------------------------------------------------------------- watch setup */

/**
 * A saved country + services pairing (the app's EditionPreset — owner 08-03:
 * "저장해서 선택할 수 있게"). One click swaps both: home vs. travelling, or two
 * households on one account.
 */
export type WatchSetup = {
  id: string;
  label: string;
  country: string;
  providers: number[];
};

export type WatchPrefs = {
  /** ISO 3166-1 alpha-2. Availability scope only — never a language. */
  country: string;
  /** TMDB provider ids the viewer actually pays for. */
  providers: number[];
  /** Release-title language. English is the source language and the fallback. */
  contentLang: ContentLang;
  /** Saved country+services pairings, most recently saved first. */
  setups: WatchSetup[];
  /** Drop films already marked Seen from ranked surfaces. Signed-in only. */
  hideSeen: boolean;
};

export const WATCH_PREFS_KEY = "mt-watch-prefs";

export const DEFAULT_WATCH_PREFS: WatchPrefs = {
  country: "US",
  providers: [],
  contentLang: DEFAULT_CONTENT_LANG,
  setups: [],
  hideSeen: false,
};

/** Same country + same services is the same setup — replace, never stack. */
export function setupId(country: string, providers: number[]): string {
  return `${country.toUpperCase()}-${[...providers].sort((a, b) => a - b).join(".")}`;
}

export function sameSetup(a: WatchSetup, country: string, providers: number[]): boolean {
  return a.country === country
    && a.providers.length === providers.length
    && a.providers.every((id) => providers.includes(id));
}

/** ISO2 → 🇰🇷. Pure code-point math, so server and client always agree (no ICU). */
export function flagOf(cc: string): string {
  return cc && cc.length === 2
    ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
    : "";
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * Tolerant read of whatever is in storage. Accepts the legacy
 * `{ country, providers }` shape the Screener and the Marquee wrote, so a
 * returning visitor keeps their services and simply gains the new axes at their
 * defaults. Anything unrecognised falls back rather than being trusted — an
 * unknown language code would be handed to the RPC as a column suffix that does
 * not exist.
 */
export function parseWatchPrefs(raw: unknown): WatchPrefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const setups = Array.isArray(o.setups)
    ? (o.setups as unknown[])
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({
          id: String(s.id ?? ""),
          label: String(s.label ?? ""),
          country: String(s.country ?? "").toUpperCase(),
          providers: Array.isArray(s.providers) ? (s.providers as unknown[]).filter(num) : [],
        }))
        .filter((s) => s.id && s.country)
        .slice(0, 8)
    : [];
  return {
    country: typeof o.country === "string" && o.country.length === 2
      ? o.country.toUpperCase()
      : DEFAULT_WATCH_PREFS.country,
    providers: Array.isArray(o.providers) ? (o.providers as unknown[]).filter(num) : [],
    contentLang: isContentLang(o.contentLang) ? o.contentLang : DEFAULT_CONTENT_LANG,
    setups,
    hideSeen: o.hideSeen === true,
  };
}
