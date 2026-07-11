import { permanentRedirect } from "next/navigation";

/** /atlas/[country] → /locations/[country] — see app/atlas/page.tsx for why. */
export default async function OldAtlasCountryRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/locations/${slug}`);
}
