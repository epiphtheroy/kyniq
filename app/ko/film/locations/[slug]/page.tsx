import type { Metadata } from "next";
import { FilmLocationsPage, filmLocationsMetadata } from "@/app/film/locations/[slug]/_shared";

/** KO film locations — the §6.5 flagship ("화양연화 촬영지"). Chrome + place names
 *  in Korean; the map/data are shared. */

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 86400;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filmLocationsMetadata((await params).slug, "ko");
}

export default async function Page({ params }: Props) {
  return FilmLocationsPage({ slug: (await params).slug, locale: "ko" });
}
