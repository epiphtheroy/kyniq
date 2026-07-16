import type { Metadata } from "next";
import { FilmPage, filmMetadata } from "@/app/film/[slug]/_shared";

/** KO film main — wave 1 of the locale projection (work order §4.1, §4.2).
 *  Identical to the EN shell but for the locale: same module, same loaders, same
 *  markup. A new language is this file with its code swapped (§-2.2 step 6). */

interface Props { params: Promise<{ slug: string }>; }

export const revalidate = 300;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filmMetadata((await params).slug, "ko");
}

export default async function Page({ params }: Props) {
  return FilmPage({ slug: (await params).slug, locale: "ko" });
}
