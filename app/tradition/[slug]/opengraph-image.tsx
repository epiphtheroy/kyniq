import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
export const size = OG_SIZE; export const contentType = OG_CONTENT_TYPE;
export const alt = "A theory tradition — Metatake";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data: tc } = await ogDb().from("theory_canon").select("title, theorist").eq("slug", slug).limit(1).maybeSingle();
    if (!tc) return ogFallback();
    return ogCard({ eyebrow: "Theory Tradition", title: tc.title as string,
      subtitle: (tc.theorist as string | null) ? `${tc.theorist} — read through film on Metatake` : "A school of thought, read through film" });
  } catch { return ogFallback(); }
}
