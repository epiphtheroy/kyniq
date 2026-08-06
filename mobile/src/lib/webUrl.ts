// The URL the in-app reader opens on metatake.net.
//
// Shared by read.tsx and read.web.tsx: they are two shells around the same
// address, and an address computed twice is an address that eventually differs.
//
// A Korean app that opens an English web page has changed language halfway
// through a tap. But the web ships exactly THREE localized route shapes
// (app/ko/film/[slug], app/ko/director/[slug], app/ko/film/locations/[slug]) —
// so this is an allowlist, not a prefix rule. "/ko/takescore/x" is a 404, and a
// 404 on this site does not stay a 404: ISR caches it for an hour.
//
// Anything not listed stays English. A worse read beats a dead page.
import { METATAKE_BASE } from "../config";

const LOCALIZED_WEB = [/^\/film\/locations\/[^/]+$/, /^\/film\/[^/]+$/, /^\/director\/[^/]+$/];

/** The path as the web serves it in `locale` — unchanged where it has no shell. */
export function localizedPath(path: string, locale: string): string {
  if (locale === "en") return path;
  // Split before any ?query or #hash: the prefix goes on the pathname only.
  const [bare, ...rest] = path.split(/(?=[?#])/);
  if (!LOCALIZED_WEB.some((re) => re.test(bare))) return path;
  return `/${locale}${bare}${rest.join("")}`;
}

/** The full reader URL. */
export function readerUrl(path: string, locale: string): string {
  return `${METATAKE_BASE}${localizedPath(path, locale)}`;
}
