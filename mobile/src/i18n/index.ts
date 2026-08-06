// UI chrome i18n. Invariant §13-11: no hardcoded UI strings in screens — use t().
// Content (invitations, takes, prose) is NOT translated here; it comes from the DB
// via the web locale projection (`_<loc>` columns) and falls back to English.
import { getLocales } from "expo-localization";
import { en, type DictKey } from "./dict/en";
import { ko } from "./dict/ko";
import { es } from "./dict/es";
import { ja } from "./dict/ja";
import type { UILocale } from "../editions";

const DICTS: Record<UILocale, Record<DictKey, string>> = { en, ko, es, ja };

/** Database overrides, per locale. Empty until overrides.ts fills them; a key
 *  present here wins over the bundle so a string can be corrected for every
 *  language at once without an app release. See overrides.ts for why the bundle
 *  still exists. */
const OVERRIDES: Partial<Record<UILocale, Record<string, string>>> = {};

/** Bumped whenever overrides land, so screens re-render with the new copy. */
let overrideVersion = 0;
const listeners = new Set<() => void>();

export function applyOverrides(locale: string, map: Record<string, string>): void {
  if (!(locale in DICTS)) return;
  OVERRIDES[locale as UILocale] = map;
  overrideVersion += 1;
  for (const fn of listeners) fn();
}

/** Subscribe to override arrival (used by a tiny root-level re-render hook). */
export function onOverrides(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function overridesVersion(): number {
  return overrideVersion;
}

let current: UILocale = "en";

export function setLocale(locale: string): void {
  current = (locale in DICTS ? locale : "en") as UILocale;
}

export function getLocale(): UILocale {
  return current;
}

export function deviceLocale(): UILocale {
  const code = getLocales()[0]?.languageCode ?? "en";
  return (code && code in DICTS ? code : "en") as UILocale;
}

export function deviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

export function t(key: DictKey, vars?: Record<string, string | number>): string {
  let s: string = OVERRIDES[current]?.[key] ?? DICTS[current][key] ?? en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

export type { DictKey };
