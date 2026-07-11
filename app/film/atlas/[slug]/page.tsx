import { permanentRedirect } from "next/navigation";

/**
 * /film/atlas/[slug] → /film/locations/[slug] (terminology cleanup 2026-07-11:
 * "atlas" → "locations"; mirrors /film/lineage/[slug]). 308 so the ~1,000
 * per-film location read pages already in the sitemap/IndexNow transfer.
 */
export default async function OldFilmAtlasRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/film/locations/${slug}`);
}
