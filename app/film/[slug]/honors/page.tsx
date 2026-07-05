import { permanentRedirect } from "next/navigation";

/**
 * /film/[slug]/honors → /film/lineage/[slug] (route renamed 2026-07-06, user
 * decision). 308 so the ~500 URLs already pinged to IndexNow / advertised in
 * the first hours transfer cleanly. Whole-pattern redirect — no slug_aliases
 * rows needed.
 */
export default async function OldHonorsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/film/lineage/${slug}`);
}
