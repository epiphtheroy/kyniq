import { permanentRedirect } from "next/navigation";

/**
 * /film/[slug]/misreadings → /film/meaning/[slug] (route renamed 2026-07-16,
 * mirrors the earlier /film/[slug]/locations → /film/locations/[slug] move).
 * 308 so the ~1,900 URLs already in the sitemap/IndexNow and any external links
 * transfer cleanly, and Google re-evaluates the de-templated page under a fresh
 * URL. Whole-pattern redirect — no slug_aliases rows needed.
 */
export default async function OldMisreadingsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/film/meaning/${slug}`);
}
