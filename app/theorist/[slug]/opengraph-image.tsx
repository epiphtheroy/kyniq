import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A theorist on Metatake";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = ogDb();
    const { data: t } = await db.from("theorists").select("name, blurb").eq("slug", slug).maybeSingle();
    if (!t) return ogFallback();
    const [rdRes, eelRes] = await Promise.all([
      db.rpc("theorist_readings", { p_slug: slug }),
      db.from("essay_entity_links").select("essay_id", { count: "exact", head: true }).eq("entity_type", "theorist").eq("entity_slug", slug),
    ]);
    const nReadings = ((rdRes.data ?? []) as unknown[]).length;
    const nEssays = eelRes.count ?? 0;
    const badges = [
      nReadings ? { label: nReadings === 1 ? "reading" : "readings", value: String(nReadings), tone: "score" as const } : null,
      nEssays ? { label: "essays cite", value: String(nEssays), tone: "plain" as const } : null,
    ].filter(Boolean) as { label: string; value: string; tone: "score" | "plain" }[];
    return ogCard({
      eyebrow: "Theorist",
      title: t.name as string,
      subtitle: (t.blurb as string | null)?.slice(0, 96) || "The cinema, read through their ideas",
      badges,
    });
  } catch { return ogFallback(); }
}
