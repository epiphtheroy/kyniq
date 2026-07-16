"use client";

/** EN ↔ localized-language switcher.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §7)
 *
 *  Replaces the dead `EN ▾` placeholder in the nav (philosopher-panel E6 removes
 *  that placeholder; this IS its re-introduction as a working control — the two
 *  goals meet here, no conflict).
 *
 *  Shows one link per live projected locale, each pointing at THIS page's twin in
 *  that language (locTwin handles both URL schemes: the /{locale} prefix and the
 *  legacy /film/x/{desk}/ko suffix). On a page type that has no twin, the whole
 *  control hides rather than link into a 404. The current locale renders as a
 *  plain label, the others as links.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALES,
  LIVE_LOCALES,
  PROJECTED_LOCALES,
  stripLocale,
  locTwin,
} from "@/lib/i18n";
import { DESK_KEYS } from "@/lib/desks";

// DESK_KEYS is a small static list; passing it lets locTwin recognise the legacy
// ko-essay suffix (/film/x/{desk}/ko) without this client bundle importing the
// markdown renderer that lib/desks drags in server-side.
const DESK_SET = new Set<string>(DESK_KEYS);
const isDesk = (d: string) => DESK_SET.has(d);

export default function LocaleSwitcher() {
  const pathname = usePathname() || "/";
  // Nothing to switch to unless at least one projected language is live.
  if (PROJECTED_LOCALES.length === 0) return null;

  const here = stripLocale(pathname).locale;
  // Build the twin for every live locale; keep only the ones that exist.
  const opts = LIVE_LOCALES.map((l) => ({
    locale: l,
    href: l === here ? pathname : locTwin(l, pathname, isDesk),
  })).filter((o) => o.href !== null);

  // If this page type has no twin in any other language, hide the control.
  const hasOther = opts.some((o) => o.locale !== here && o.href);
  if (!hasOther) return null;

  return (
    <div className="lang" role="group" aria-label="Language">
      {opts.map((o, i) => (
        <span key={o.locale}>
          {i > 0 ? <span className="lang-sep" aria-hidden="true"> · </span> : null}
          {o.locale === here ? (
            <span className="lang-cur" aria-current="true">{LOCALES[o.locale].label}</span>
          ) : (
            <Link className="lang-alt" href={o.href!} hrefLang={o.locale}>
              {LOCALES[o.locale].label}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
