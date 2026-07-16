"use client";

/** Sets <html lang> for a projected-locale subtree.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §6.4)
 *
 *  The document lang lives on the root layout (`<html lang="en">`), which a
 *  nested route-group layout cannot rewrite. Crawlers take hreflang over the SSR
 *  lang attribute, so the mismatch is not fatal — but for screen readers and
 *  correct hyphenation we still flip it on the client. Renders nothing.
 */

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";

export default function SetHtmlLang({ lang }: { lang: Locale }) {
  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = prev;
    };
  }, [lang]);
  return null;
}
