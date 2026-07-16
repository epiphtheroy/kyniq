"use client";

/** Locale for client components.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §2.5)
 *
 *  Server components get `locale` as an explicit prop — easier to trace, and the
 *  shells already know it. This exists for the client chrome, where a prop can't
 *  reach:
 *
 *  - Nav is a client component with three callers (SiteNav, SiteNavClient,
 *    HomeV2), and SiteNavClient is itself rendered from client pages that have
 *    no server-side locale to hand down.
 *  - Footer renders in the ROOT layout, outside `{children}` — no route-group
 *    layout can wrap it, so no provider can reach it either.
 *
 *  So useLocale() falls back to reading the URL. A `/{locale}` prefix is the
 *  whole truth about which language a page is (stripLocale), which makes the
 *  pathname a sound source and lets un-wrapped chrome localize itself. The
 *  provider stays for surfaces that want to state their locale explicitly, and
 *  for any future locale that is not expressed in the path.
 */

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, stripLocale, type Locale } from "@/lib/i18n";

const LocaleCtx = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

/** useLocale — the locale of the surface this component is rendering on.
 *  Provider value if there is one, else derived from the path, else the source
 *  language. Never throws: a component outside any provider on an un-prefixed
 *  route is simply English, which is the correct answer (P2). */
export function useLocale(): Locale {
  const ctx = useContext(LocaleCtx);
  const pathname = usePathname();
  if (ctx) return ctx;
  return pathname ? stripLocale(pathname).locale : DEFAULT_LOCALE;
}
