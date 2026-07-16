import type { Metadata } from "next";
import { FilmLocationsPage, filmLocationsMetadata } from "./_shared";

/** EN film locations — source-language shell (work order §4.1, P1). */

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 86400;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filmLocationsMetadata((await params).slug, "en");
}

export default async function Page({ params }: Props) {
  return FilmLocationsPage({ slug: (await params).slug, locale: "en" });
}
