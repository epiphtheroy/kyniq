import { ogCard, ogFallback, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "Metatake catalog";
function titleCase(s: string) { return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
export default async function Image({ params }: { params: Promise<{ seg: string; slug: string }> }) {
  try {
    const { seg, slug } = await params;
    return ogCard({ eyebrow: titleCase(seg), title: titleCase(slug),
      subtitle: "A pattern in cinema, read across the films that share it" });
  } catch { return ogFallback(); }
}
