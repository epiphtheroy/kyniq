import { permanentRedirect } from "next/navigation";

/**
 * /idea/[slug] → /concept/[slug] (terminology charter 2026-07-07).
 * The unified /concept page resolves SM variant slugs itself, so a plain
 * whole-pattern 308 is safe; unknown slugs 404 at the destination.
 */
export default async function OldIdeaDetailRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/concept/${slug}`);
}
