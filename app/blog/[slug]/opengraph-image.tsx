import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "Metatake — The Daily";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data: p } = await ogDb().from("posts").select("title, dek, edition_date").eq("slug", slug).eq("status", "published").maybeSingle();
    if (!p) return ogFallback();
    return ogCard({ eyebrow: "The Daily", title: p.title as string,
      subtitle: (p.dek as string | null) || (p.edition_date ? `Metatake · ${p.edition_date}` : "Between film and the world") });
  } catch { return ogFallback(); }
}
