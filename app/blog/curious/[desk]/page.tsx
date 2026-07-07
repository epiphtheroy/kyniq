import { permanentRedirect } from "next/navigation";

/**
 * /blog/curious/[desk] → /curious/[desk] (section split out of the blog
 * 2026-07-07). Whole-pattern 308 — no per-desk validation needed; unknown
 * desks 404 at the destination.
 */
export default async function OldCuriousDeskRedirect({ params }: { params: Promise<{ desk: string }> }) {
  const { desk } = await params;
  permanentRedirect(`/curious/${desk}`);
}
