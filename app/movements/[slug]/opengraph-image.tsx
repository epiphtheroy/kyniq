import { ogCard, ogFallback, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "A film movement — Metatake";
function titleCase(s: string) { return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return ogCard({ eyebrow: "Film Movement", title: titleCase(slug),
      subtitle: "The films, the ideas, and the readings that define the movement" });
  } catch { return ogFallback(); }
}
