"use client";

/** "본 페이지를 한국어로" — a one-time suggestion, never a redirect.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §7)
 *
 *  A reader whose browser language is a live projected locale, sitting on the
 *  English twin of a localized page, gets a slim top bar offering the switch.
 *  Rules that matter:
 *   - NEVER a redirect. Googlebot crawls from a US IP; an IP/lang redirect would
 *     hide the English page from it. Suggestion only.
 *   - middleware is untouched (its bot-enforcement logic isn't worth the risk of
 *     interleaving locale logic). This is pure client.
 *   - dismissed once → remembered forever (localStorage).
 *   - only shows when a twin actually exists (locTwin), so it never offers a 404.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALES,
  PROJECTED_LOCALES,
  stripLocale,
  locTwin,
  type Locale,
} from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { DESK_KEYS } from "@/lib/desks";

const DESK_SET = new Set<string>(DESK_KEYS);
const isDesk = (d: string) => DESK_SET.has(d);
const DISMISS_KEY = "mt_locale_dismissed";

export default function LocaleSuggestBanner() {
  const pathname = usePathname() || "/";
  const [target, setTarget] = useState<{ locale: Locale; href: string } | null>(null);

  useEffect(() => {
    if (PROJECTED_LOCALES.length === 0) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage blocked → just don't persist; still fine to show once.
    }
    // Already on a non-English page? Nothing to suggest.
    if (stripLocale(pathname).locale !== "en") return;
    // Match the browser's preferred language to a live projected locale.
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    const want = PROJECTED_LOCALES.find((l) => langs.some((bl) => bl?.toLowerCase().startsWith(l)));
    if (!want) return;
    const href = locTwin(want, pathname, isDesk);
    if (href) setTarget({ locale: want, href });
  }, [pathname]);

  if (!target) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setTarget(null);
  };

  return (
    <div className="i18n-suggest" lang={target.locale}>
      <Link className="i18n-suggest__go" href={target.href} onClick={dismiss}>
        {t(target.locale, "Read this page in {language} →", { language: LOCALES[target.locale].label })}
      </Link>
      <button className="i18n-suggest__x" onClick={dismiss} aria-label={t(target.locale, "Dismiss")}>
        ✕
      </button>
    </div>
  );
}
