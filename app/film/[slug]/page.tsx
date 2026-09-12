import type { Metadata } from "next";
import { FilmPage, filmMetadata } from "./_shared";

/** EN film main — the source-language shell (work order §4.1, invariant P1).
 *  The page itself lives in _shared.tsx and is rendered identically for every
 *  locale; a shell only says which one. Keep it thin: body that leaks in here
 *  stops reaching the other languages. */

interface Props { params: Promise<{ slug: string }>; }

// 300s until 2026-09-12 — the same mistake 2281585a fixed on the figure page,
// left behind here. On 2026-09-11 this route wrote 30,086 ISR write units, more
// than any other and a third of the site's total, on a day of 28,950 requests:
// the crawler sweep revisits a film faster than the window expires, so nearly
// every visit was a MISS that re-rendered and re-wrote. The body only moves when
// the factory ingests, and the factory purges the path itself (worker/factory.py
// -> /api/revalidate), so the window is a floor, not the freshness guarantee.
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filmMetadata((await params).slug, "en");
}

export default async function Page({ params }: Props) {
  return FilmPage({ slug: (await params).slug, locale: "en" });
}
