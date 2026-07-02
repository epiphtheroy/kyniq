import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import AccessCountryProvider from "@/components/AccessCountryProvider";
import WatchPageClient, { type WatchFilm, type WatchData } from "@/components/WatchPageClient";
import type { AccessRecord } from "@/components/AccessEnrichment";
import accessEnrichment from "@/lib/access_enrichment.json";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

interface Props { params: Promise<{ slug: string }>; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function accessRecordFor(tmdbId: number | null | undefined): AccessRecord | null {
  if (!tmdbId) return null;
  const films = (accessEnrichment as unknown as { films: Record<string, AccessRecord> }).films;
  return films[String(tmdbId)] ?? null;
}

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, runtime, poster_path, imdb_id, tmdb_id")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  const { data: wpRow } = await supabase
    .from("film_watch_providers").select("results, countries").eq("film_id", film.id).maybeSingle();
  return {
    film: film as WatchFilm & { id: string },
    watch: (wpRow as WatchData) ?? null,
    record: accessRecordFor((film as { tmdb_id: number | null }).tmdb_id),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film } = data;
  const title = `Where to watch ${film.title}${film.year ? ` (${film.year})` : ""} — streaming, free archives, disc & subtitles · Metatake`;
  const description = `Every legal way to watch ${film.title}${film.year ? ` (${film.year})` : ""} — streaming, rent and buy by country (via JustWatch & TMDB), plus MetaTake-verified free archives, MUBI country differences, disc editions and subtitle links.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `/film/${slug}/watch` },
  };
}

export default async function FilmWatchPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, watch, record } = data;
  return (
    <div className="mt">
      <SiteNav />
      <AccessCountryProvider>
        <WatchPageClient film={film} watch={watch} record={record} />
      </AccessCountryProvider>
    </div>
  );
}
