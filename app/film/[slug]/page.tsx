import type { Metadata } from "next";
import { FilmPage, filmMetadata } from "./_shared";

/** EN film main — the source-language shell (work order §4.1, invariant P1).
 *  The page itself lives in _shared.tsx and is rendered identically for every
 *  locale; a shell only says which one. Keep it thin: body that leaks in here
 *  stops reaching the other languages. */

interface Props { params: Promise<{ slug: string }>; }

export const revalidate = 300;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filmMetadata((await params).slug, "en");
}

export default async function Page({ params }: Props) {
  return FilmPage({ slug: (await params).slug, locale: "en" });
}
