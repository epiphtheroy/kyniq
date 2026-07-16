import type { Metadata } from "next";
import { DirectorPage, directorMetadata } from "@/app/director/[slug]/_shared";

/** KO director main — locale projection wave 1 (work order §4.2). */

interface Props { params: Promise<{ slug: string }>; }

export const revalidate = 300;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return directorMetadata((await params).slug, "ko");
}

export default async function Page({ params }: Props) {
  return DirectorPage({ slug: (await params).slug, locale: "ko" });
}
