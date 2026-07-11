import { permanentRedirect } from "next/navigation";

/** /atlas/[country]/[city] → /locations/[country]/[city] — see app/atlas/page.tsx. */
export default async function OldAtlasCityRedirect({ params }: { params: Promise<{ slug: string; city: string }> }) {
  const { slug, city } = await params;
  permanentRedirect(`/locations/${slug}/${city}`);
}
