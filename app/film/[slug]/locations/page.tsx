import { permanentRedirect } from "next/navigation";

/**
 * /film/[slug]/locations → /film/atlas/[slug] (route renamed 2026-07-06, user
 * decision — mirrors /film/lineage/[slug]). 308 so the 1,000 URLs already in
 * the sitemap/IndexNow transfer cleanly. Whole-pattern redirect — no
 * slug_aliases rows needed.
 */
export default async function OldLocationsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/film/atlas/${slug}`);
}
