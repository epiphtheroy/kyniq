import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import GalleryViewer from "@/components/GalleryViewer";
import ShareDock from "@/components/ShareDock";
import ReadPlates from "@/components/read/ReadPlates";
import "@/app/curious/curious.css";

// Images change rarely; cache the TMDB call for a day (ISR).
export const revalidate = 86400;
// Enables the on-demand Full Route Cache (ISR HIT) instead of dynamic renders.
export async function generateStaticParams() { return []; }

const TMDB = process.env.TMDB_READ_TOKEN;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Img = { file_path: string; width: number; height: number; iso_639_1: string | null; vote_count?: number };

// Cached per slug so the uncached Supabase lookup doesn't force dynamic rendering.
function filmBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const { data } = await db().from("films").select("id, title, slug, year, tmdb_id").eq("slug", slug).maybeSingle();
      return data as { id: string; title: string; slug: string; year: number | null; tmdb_id: number | null } | null;
    },
    ["gallery-film", slug],
    { revalidate: 86400, tags: [`film:${slug}`] },
  )();
}

async function tmdbImages(tmdbId: number): Promise<{ backdrops: Img[]; posters: Img[] } | null> {
  if (!TMDB) return null;
  const base = `https://api.themoviedb.org/3/movie/${tmdbId}/images`;
  const useBearer = TMDB.length > 40;
  const url = useBearer ? base : `${base}?api_key=${TMDB}`;
  const headers: Record<string, string> = useBearer ? { Authorization: `Bearer ${TMDB}`, accept: "application/json" } : { accept: "application/json" };
  try {
    const r = await fetch(url, { headers, next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const j = await r.json();
    // Sort: prefer images with no language tag (clean, text-free) then by votes.
    const sort = (a: Img, b: Img) => (Number(!a.iso_639_1) - Number(!b.iso_639_1)) * -1 || (b.vote_count ?? 0) - (a.vote_count ?? 0);
    return { backdrops: (j.backdrops ?? []).slice().sort(sort), posters: (j.posters ?? []).slice().sort(sort) };
  } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const film = await filmBySlug(slug);
  const name = film ? `${film.title}${film.year ? ` (${film.year})` : ""}` : slug;
  return {
    title: `${name} — gallery`,
    description: `Image gallery for ${name} — backdrops and posters via TMDB.`,
    // Thin (image-only) page: keep it out of the index; the film page is canonical.
    robots: { index: false, follow: false },
    alternates: { canonical: `/film/${slug}` },
  };
}

export default async function FilmGalleryPage({ params }: Props) {
  const { slug } = await params;
  const film = await filmBySlug(slug);
  if (!film || !film.tmdb_id) notFound();

  const imgs = await tmdbImages(film.tmdb_id);
  const backdrops = imgs?.backdrops ?? [];
  const posters = imgs?.posters ?? [];

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="df-crumb" style={{ marginBottom: 12 }}>
          <Link href="/film">Films</Link><span className="df-sep">›</span>
          <Link href={`/film/${film.slug}`}>{film.title}{film.year ? ` (${film.year})` : ""}</Link><span className="df-sep">›</span>
          <span>Gallery</span>
        </div>
        <h1 className="gal-h1">{film.title} {film.year ? <span className="gal-yr">({film.year})</span> : null} <span className="gal-h1k">gallery</span></h1>
        <div className="rd-share" style={{ marginTop: 12 }}>
          <ShareDock variant="bar" path={`/film/${film.slug}/gallery`} title={`${film.title}${film.year ? ` (${film.year})` : ""} gallery`} />
          <ShareDock variant="fab" path={`/film/${film.slug}/gallery`} title={`${film.title}${film.year ? ` (${film.year})` : ""} gallery`} />
        </div>
        <p style={{ margin: "2px 0 18px" }}>
          <Link href={`/film/${film.slug}`}>← Back to {film.title} on Metatake</Link>
        </p>
        {backdrops.length === 0 && posters.length === 0 ? (
          <p className="gal-empty">
            No images available for this title.{" "}
            <a href={`/film/${film.slug}`}>Back to {film.title} →</a>
            {!TMDB ? <><br /><span style={{ fontSize: 12, color: "var(--subtle)" }}>(TMDB image API not configured.)</span></> : null}
          </p>
        ) : (
          <GalleryViewer backdrops={backdrops} posters={posters} title={film.title} year={film.year} filmSlug={film.slug} />
        )}
      </div>
      <ReadPlates slug={film.slug} exclude="gallery" />
    </div>
  );
}
